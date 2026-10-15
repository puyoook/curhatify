# 🎵 Curhatify

> **"Curhat lewat lagu, tanpa perlu ngaku."**

Curhatify adalah platform web curhatan anonim berbasis musik yang memungkinkan pengguna untuk membagikan perasaan, kisah, dan pesan tersembunyi yang terhubung langsung dengan pratinjau lagu favorit dari Spotify.

![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla%20JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

---

## 🚀 Live Demo

Uji coba platform Curhatify secara langsung melalui tautan berikut:
👉 **[https://curhatify.vercel.app](https://curhatify.vercel.app)** *(Ganti dengan link Vercel Anda)*

---

## ✨ Fitur Utama

- 🔒 **100% Anonim & Aman**: Kirim curhatan dan pesan rahasia tanpa perlu mendaftar atau *login*.
- 🎧 **Integrasi Musik Spotify**: Sertakan cuplikan lagu yang mewakili suasana hati (*mood*) dari curhatan Anda.
- 🎛️ **Sticky Audio Player Bar**: Pemutar musik melayang yang persisten di bagian bawah layar dengan kontrol durasi (*seek bar*), *play/pause*, dan link langsung ke Spotify.
- 🎨 **Glassmorphism UI/UX Modern**: Antarmuka futuristik berbasis *Dark Mode* yang responsif untuk pengguna desktop dan *mobile*.
- 🎬 **Custom Story Generator Video**:
  - Konversi curhatan menjadi animasi piringan hitam (*vinyl animation*) & *equalizer* interaktif menggunakan HTML5 Canvas.
  - Ekspor video story dengan pilihan resolusi (540p, 720p HD, 1080p Full HD) dan format (MP4 / WebM).
- 🔍 **Filter & Pencarian Pintar**:
  - Filter curhatan berdasarkan *mood* (Patah Hati, Tengah Malam, Apresiasi, Pemulihan, dll.).
  - Fitur pengurutan (Terbaru, Like Terbanyak, Terlama) dan tombol acak curhatan (*shuffle*).
- ⚡ **Performa & Paginasi Cepat**: Sistem *Load More* ("Muat Lebih Banyak") yang ringan dan hemat kuota di perangkat seluler.
- ♿ **Standar Aksesibilitas (WCAG)**: Mendukung penuh navigasi pembaca layar (*screen reader*) dan ramah aksesibilitas.

---

## 🛠️ Tech Stack

### Frontend
- **HTML5 & CSS3** (Custom Glassmorphism Styles & Responsive Layout)
- **Vanilla JavaScript (ES6+)**
- **Tailwind CSS** (CDN integration)
- **Font Awesome 6** (Icons)
- **MediaRecorder & Canvas API** (Ekspor Video & Animasi Story)

### Backend
- **Node.js & Express.js**
- **MongoDB & Mongoose** (Database NoSQL)
- **Vercel Analytics** (Pelacakan lalu lintas pengunjung)

---

## 📂 Struktur Proyek

```text
curhatify/
├── backend/
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── .env.example
│   └── server.js
├── frontend/
│   ├── css/
│   ├── js/
│   │   └── app.js
│   └── index.html
├── .gitignore
├── README.md
└── package.json