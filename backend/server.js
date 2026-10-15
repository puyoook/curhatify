// 1. Inisialisasi Environment Variable & Package
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Groq = require('groq-sdk');
const https = require('https');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// --- KONFIGURASI RATE LIMITER (ANTI-SPAM) ---

// 1. Limiter Pembuatan Curhat (Maksimal 3 curhatan per 10 menit per IP)
const createConfessionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 menit
  max: 3, 
  message: { 
    success: false, 
    error: 'Anda terlalu sering mengirim curhatan. Harap tunggu beberapa menit sebelum mencoba lagi.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Limiter Khusus Rekomendasi AI (Maksimal 5 kali panggil per 10 menit per IP)
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 menit
  max: 5,
  message: { 
    success: false, 
    error: 'Batas pemanggilan rekomendasi AI tercapai. Coba lagi dalam beberapa menit.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- MIDDLEWARE EXPRESS & CORS ---
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// --- INISIALISASI GROQ AI CLIENT ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- KONEKSI MONGODB & SEED ADMIN DEFAULT ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Berhasil terhubung ke MongoDB!");
    seedInitialAdmin();
  })
  .catch(err => console.error("Gagal terhubung ke MongoDB:", err));

// --- SKEMA MONGODB ---
const confessionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  songTitle: { type: String, required: true },
  artist: String,
  mood: { type: String, default: 'Pesan Tak Terucap' },
  coverUrl: String,
  audioUrl: String,
  trackId: String,
  timestamp: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 },
  reportCount: { type: Number, default: 0 },
  isHidden: { type: Boolean, default: false }
});
const Confession = mongoose.model('Confession', confessionSchema);

const feedbackSchema = new mongoose.Schema({
  category: { type: String, default: 'Saran' },
  message: { type: String, required: true },
  contact: { type: String, default: 'Anonim' },
  timestamp: { type: Date, default: Date.now }
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Admin = mongoose.model('Admin', adminSchema);

// --- SEED ADMIN DEFAULT ---
async function seedInitialAdmin() {
  try {
    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASS;

    if (!adminUser || !adminPass) return;

    const existingAdmin = await Admin.findOne({ username: adminUser });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPass, 10);
      await Admin.create({ username: adminUser, password: hashedPassword });
      console.log(`Admin default (${adminUser}) berhasil dibuat!`);
    }
  } catch (err) {
    console.error("Gagal membuat admin default:", err);
  }
}

// Middleware Verifikasi Token JWT Admin
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(403).json({ error: "Akses ditolak, token tidak ada!" });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token tidak valid atau kadaluwarsa!" });
  }
};

// --- ENDPOINT PUBLIK ---

// 1. Ambil Semua Curhatan Publik (GET)
app.get('/api/confessions', async (req, res) => {
  try {
    const visibleConfessions = await Confession.find({ isHidden: false, reportCount: { $lt: 20 } })
                                               .sort({ timestamp: -1 });
    const formattedData = visibleConfessions.map(c => ({
      id: c._id.toString(),
      text: c.text,
      songTitle: c.songTitle,
      artist: c.artist,
      mood: c.mood || 'Pesan Tak Terucap',
      coverUrl: c.coverUrl,
      audioUrl: c.audioUrl,
      trackId: c.trackId,
      likes: c.likes || 0,
      reportCount: c.reportCount || 0,
      isHidden: c.isHidden || false,
      timestamp: c.timestamp
    }));
    res.json({ success: true, data: formattedData });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data dari database" });
  }
});

// 2. Tambah Curhatan Baru (POST + RATE LIMITER + VALIDASI KARAKTER)
app.post('/api/confessions', createConfessionLimiter, async (req, res) => {
  const { text, songTitle, artist, mood, coverUrl, audioUrl, trackId } = req.body;
  if (!text || !songTitle) return res.status(400).json({ error: "Pesan dan lagu wajib diisi!" });

  const trimmedText = text.trim();
  if (trimmedText.length < 10) {
    return res.status(400).json({ error: 'Pesan curhat terlalu pendek (minimal 10 karakter).' });
  }
  if (trimmedText.length > 500) {
    return res.status(400).json({ error: 'Pesan curhat terlalu panjang (maksimal 500 karakter).' });
  }

  try {
    const newConfession = new Confession({
      text: trimmedText,
      songTitle,
      artist,
      mood: mood || 'Pesan Tak Terucap',
      coverUrl,
      audioUrl,
      trackId
    });
    await newConfession.save();
    res.status(201).json({ success: true, data: newConfession });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan ke database" });
  }
});

// 3. Tambah / Hapus Like
app.post('/api/confessions/:id/like', async (req, res) => {
  try {
    const { action } = req.body;
    const confession = await Confession.findById(req.params.id);
    if (!confession) return res.status(404).json({ error: "Curhatan tidak ditemukan" });

    if (action === 'add') confession.likes += 1;
    if (action === 'remove' && confession.likes > 0) confession.likes -= 1;
    
    await confession.save();
    res.json({ success: true, likes: confession.likes });
  } catch (err) {
    res.status(500).json({ error: "Gagal memperbarui like" });
  }
});

// 4. Laporkan (Report) - Auto Hide jika reportCount >= 20
app.post('/api/confessions/:id/report', async (req, res) => {
  try {
    const confession = await Confession.findById(req.params.id);
    if (!confession) return res.status(404).json({ error: "Curhatan tidak ditemukan" });

    confession.reportCount += 1;
    if (confession.reportCount >= 20) {
      confession.isHidden = true;
    }
    
    await confession.save();
    res.json({ success: true, message: "Berhasil dilaporkan", reportCount: confession.reportCount, isHidden: confession.isHidden });
  } catch (err) {
    res.status(500).json({ error: "Gagal melaporkan curhatan" });
  }
});

// 5. Endpoint Rekomendasi Lagu Groq AI
app.post('/api/ai/recommend', aiLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Teks curhatan tidak boleh kosong' });
    }

    const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : '';
    if (!apiKey || !apiKey.startsWith('gsk_')) {
      console.error('[Groq Error] GROQ_API_KEY di file .env tidak valid!');
      return res.status(500).json({ 
        success: false, 
        error: 'GROQ_API_KEY di file .env tidak valid. Pastikan diawali dengan gsk_' 
      });
    }

    const groqClient = new Groq({ apiKey });

    let targetModel = null;
    try {
      const modelsList = await groqClient.models.list();
      const activeModelIds = modelsList.data.map(m => m.id);

      const validChatModels = activeModelIds.filter(id => {
        const lower = id.toLowerCase();
        return !lower.includes('whisper') && 
               !lower.includes('guard') && 
               !lower.includes('safeguard') && 
               !lower.includes('orpheus') && 
               !lower.includes('embed');
      });

      console.log('[Groq Info] Model Chat LLM yang valid di akun Anda:', validChatModels);

      targetModel = validChatModels.find(id => id.includes('qwen')) 
                 || validChatModels.find(id => id.includes('gpt-oss-120b'))
                 || validChatModels.find(id => id.includes('gpt-oss'))
                 || validChatModels.find(id => id.includes('allam'))
                 || validChatModels[0];

    } catch (listErr) {
      console.warn('[Groq Warning] Gagal mengambil daftar model otomatis:', listErr.message);
    }

    if (!targetModel) {
      targetModel = 'qwen/qwen3.8-27b';
    }

    console.log(`[Groq Info] Menggunakan model AI: ${targetModel}`);

    const chatCompletion = await groqClient.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Anda adalah pakar musik dan psikolog emosi. Analisis emosi dari curhatan pengguna, lalu rekomendasikan 1 lagu (Indonesia atau Barat populer di Spotify/iTunes) yang cocok.
Output HARUS HANYA berupa JSON murni tanpa format markdown:
{"song": "Judul Lagu", "artist": "Nama Penyanyi"}`
        },
        {
          role: "user",
          content: `Curhatan: "${text}"`
        }
      ],
      model: targetModel,
      temperature: 0.5,
      response_format: { type: "json_object" }
    });

    const aiContent = chatCompletion.choices[0]?.message?.content || '{}';
    const cleanContent = aiContent.replace(/```json|```/g, '').trim();
    const songRecommendation = JSON.parse(cleanContent);

    return res.json({
      success: true,
      data: songRecommendation
    });

  } catch (err) {
    console.error('Groq AI Final Error:', err.message || err);
    return res.status(500).json({ 
      success: false, 
      error: 'Gagal menganalisis curhatan: ' + (err.message || 'Terjadi kesalahan pada Groq AI.') 
    });
  }
});

// 6. Kirim Masukan & Kritik (Publik)
app.post('/api/feedback', async (req, res) => {
  const { category, message, contact } = req.body;
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: "Pesan masukan tidak boleh kosong!" });
  }

  try {
    const newFeedback = new Feedback({
      category: category || 'Saran',
      message: message.trim(),
      contact: contact ? contact.trim() : 'Anonim'
    });
    await newFeedback.save();
    res.status(201).json({ success: true, message: "Terima kasih atas masukan Anda!" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan masukan" });
  }
});

// 7. Proxy Pencarian Lagu iTunes (Bebas CORS)
app.get('/api/songs/search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.json({ success: true, data: [] });

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`;

  https.get(url, (apiRes) => {
    let body = '';
    apiRes.on('data', (chunk) => body += chunk);
    apiRes.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.json({ success: true, data: data.results || [] });
      } catch (e) {
        res.status(500).json({ success: false, error: 'Gagal memproses data lagu' });
      }
    });
  }).on('error', (err) => {
    console.error('iTunes API Error:', err);
    res.status(500).json({ success: false, error: 'Gagal terhubung ke server iTunes' });
  });
});

// --- ENDPOINT ADMIN ---

// 8. Login Admin
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username dan Password wajib diisi!" });

  try {
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ error: "Username atau Password salah!" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ error: "Username atau Password salah!" });

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: 'admin' }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ error: "Terjadi kesalahan server saat login" });
  }
});

// 9. Ambil SEMUA Curhatan Khusus Admin
app.get('/api/admin/confessions', verifyAdmin, async (req, res) => {
  try {
    const allConfessions = await Confession.find().sort({ timestamp: -1 });
    const formattedData = allConfessions.map(c => ({
      id: c._id.toString(),
      text: c.text,
      songTitle: c.songTitle,
      artist: c.artist,
      mood: c.mood || 'Pesan Tak Terucap',
      coverUrl: c.coverUrl,
      audioUrl: c.audioUrl,
      trackId: c.trackId,
      likes: c.likes || 0,
      reportCount: c.reportCount || 0,
      isHidden: c.isHidden || false,
      timestamp: c.timestamp
    }));
    res.json({ success: true, data: formattedData });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data admin" });
  }
});

// 10. Toggle Status Sembunyikan Admin
const handleToggleHide = async (req, res) => {
  try {
    const confession = await Confession.findById(req.params.id);
    if (!confession) return res.status(404).json({ error: "Curhatan tidak ditemukan" });

    confession.isHidden = !confession.isHidden;
    await confession.save();
    
    res.json({ 
      success: true, 
      message: confession.isHidden ? "Curhatan berhasil disembunyikan!" : "Curhatan berhasil dipublikasikan!",
      isHidden: confession.isHidden 
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal memperbarui status curhatan: " + err.message });
  }
};

app.patch('/api/admin/confessions/:id/toggle-hide', verifyAdmin, handleToggleHide);
app.post('/api/admin/confessions/:id/toggle-hide', verifyAdmin, handleToggleHide);

// 11. Hapus Curhatan Permanen
app.delete('/api/admin/confessions/:id', verifyAdmin, async (req, res) => {
  try {
    await Confession.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Curhatan berhasil dihapus permanen!" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus dari database" });
  }
});

// 12. Ambil Semua Masukan User (Khusus Admin)
app.get('/api/admin/feedback', verifyAdmin, async (req, res) => {
  try {
    const feedbackList = await Feedback.find().sort({ timestamp: -1 });
    res.json({ success: true, data: feedbackList });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data masukan" });
  }
});

// 13. Hapus Masukan User (Khusus Admin)
app.delete('/api/admin/feedback/:id', verifyAdmin, async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Masukan berhasil dihapus!" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus masukan" });
  }
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`Backend Curhatify berjalan di port ${PORT}`);
});

// Tambahkan baris ini di paling bawah server.js (setelah app.listen)
module.exports = app;