# Pandu Hotel — CMS & Booking System

Sistem manajemen hotel berbasis web dengan fitur booking online, dashboard admin, panel resepsionis, dan dashboard user.

## Tech Stack
- **Frontend**: HTML, CSS (Vanilla), JavaScript
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (JWT)

## Fitur Utama
- 🏨 Booking hotel dengan kalkulasi harga otomatis
- 📊 Dashboard admin dengan statistik & analytics
- 🛎️ Panel resepsionis untuk check-in/check-out
- 👤 Dashboard user dengan riwayat reservasi
- 🔒 Autentikasi multi-role (Admin, Staff, User)
- 📱 Responsive design (Desktop & Mobile)

## Deployment

### Environment Variables
Buat file `.env` berdasarkan `.env.example`:

```bash
cp .env.example .env
```

Isi variabel yang dibutuhkan:
| Variable | Deskripsi |
|---|---|
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_ANON_KEY` | Anon/public key Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) |
| `PORT` | Port server (default: 3000) |
| `NODE_ENV` | `production` atau `development` |
| `CORS_ORIGIN` | Comma-separated allowed origins |

### Deploy ke Render
1. Buat **Web Service** baru di [render.com](https://render.com)
2. Connect repository GitHub: `LALUARIFTA/panduhotels`
3. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Node Version**: `>=18`
4. Tambahkan environment variables di tab **Environment**
5. Deploy!

### Deploy ke Railway
1. Buat project baru di [railway.app](https://railway.app)
2. Connect repository GitHub
3. Railway otomatis mendeteksi Node.js
4. Tambahkan environment variables
5. Deploy!

### Run Locally
```bash
npm install
npm run dev
```

Server berjalan di `http://localhost:3000`

## Struktur Proyek
```
panduhotel/
├── css/              # Stylesheet
├── js/               # Frontend scripts
├── server/
│   ├── index.js      # Express entry point
│   ├── lib/          # Supabase client config
│   ├── middleware/    # Auth, logger, error handler
│   └── routes/       # API routes
├── database/         # SQL schema
├── *.html            # Frontend pages
├── package.json
└── .env.example
```

## License
MIT
