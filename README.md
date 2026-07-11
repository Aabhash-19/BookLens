# 📖 BookLens

![BookLens Banner](https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=2000&auto=format&fit=crop)

**BookLens** is an intelligent, beautifully designed full-stack web application that brings your reading life into the future. By combining cutting-edge AI image recognition, personalized machine learning recommendations, and a premium glassmorphic UI, BookLens makes discovering, tracking, and managing your library an absolute joy.

---

## ✨ Features

### 📸 AI-Powered Book Scanning
Point your camera at a book cover or barcode (or upload an image), and BookLens will instantly identify it. 
- **Optical Character Recognition (OCR):** Powered by Tesseract to read text directly off book covers.
- **Barcode Detection:** Instantly parses ISBNs using PyZbar.
- **Smart Image Processing:** Auto-resizing, denoising, and WebP compression via OpenCV and Pillow for lightning-fast uploads.

### 🧠 Semantic AI Recommendations
Discover your next favorite book with an advanced ML engine.
- **Vector Embeddings:** Uses HuggingFace `SentenceTransformers` to generate semantic profiles for users and books.
- **Explicit Preference Re-ranking:** Automatically boosts recommendations based on your explicitly chosen favorite authors, genres, and languages.
- **Cold-Start Handling:** Seamlessly blends popular trends with your personal library history.

### 📚 Personal Library Management
- Track your books across custom states: *Want to Read*, *Reading Now*, *Finished*, and *Favourited*.
- Leave personal ratings and notes on your reads.
- Syncs seamlessly with your personalized recommendation engine.

### 👤 Dynamic User Profiles
- **Real-time Avatar Uploads:** Custom profile picture uploads processed into optimized WebP formats and stored in MinIO.
- **Instant Sync:** Built with an optimistic React Context architecture that ensures changes (like updating your username or avatar) instantly reflect across the entire app without a page reload.

---

## 🛠️ Tech Stack

BookLens is built using a modern, scalable, and containerized microservice architecture.

### **Frontend**
- **Framework:** [Next.js 14](https://nextjs.org/) (React)
- **Styling:** Vanilla CSS & [Tailwind CSS](https://tailwindcss.com/)
- **Design System:** Custom glassmorphism, dynamic micro-animations, and vibrant gradients.
- **Icons:** Lucide React

### **Backend**
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database ORM:** SQLAlchemy (Async)
- **Machine Learning:** HuggingFace `SentenceTransformers`, PyTorch
- **Image Processing:** OpenCV, Pillow, PyTesseract, PyZbar

### **Infrastructure & Storage**
- **Database:** PostgreSQL
- **Object Storage:** MinIO (S3-compatible storage for avatars and book scans)
- **Containerization:** Docker & Docker Compose

---

## 🚀 Getting Started (Local Development)

### Prerequisites
Make sure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed on your machine.

### 1. Clone the repository
```bash
git clone https://github.com/Aabhash-19/BookLens.git
cd BookLens
```

### 2. Configure Environment Variables
Copy the provided example environment file and update it with your secrets.
```bash
cp .env.example .env
```

### 3. Spin up the containers
Using Docker Compose, you can start the entire stack (Database, Object Storage, API, and Frontend) with a single command:
```bash
docker compose up -d --build
```

### 4. Access the Application
- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **MinIO Console:** [http://localhost:9001](http://localhost:9001)

---

## 🎨 Design Philosophy

BookLens was engineered with a strict **"Visual Excellence"** policy. We avoided generic palettes, opting instead for curated HSL colors, deep dark modes, and smooth hover state transitions. The UI isn't just a shell—it reacts, breathes, and provides immediate visual feedback to create a premium user experience.
