# BookLens

BookLens is an intelligent, full-stack web application engineered to modernize personal library management and book discovery. By integrating advanced machine learning for semantic search and computer vision for automated book identification, the platform provides a highly personalized and automated user experience.

## Project Overview

The core objective of BookLens is to eliminate the friction typically associated with manual cataloging of physical books. Users can simply provide an image of a book cover or barcode, and the system's computer vision pipeline automatically identifies the book, retrieves its metadata from external aggregators, and allows the user to categorize it within their library. Furthermore, the application features an explicit preference-driven recommendation engine that utilizes vector embeddings to suggest contextually relevant literature.

## Key Features and Implementation Details

### Computer Vision and OCR Pipeline
The automated book identification system relies on a multi-stage image processing pipeline:
- **Image Preprocessing:** Uploaded images are immediately processed on the backend using OpenCV and the Python Imaging Library (Pillow). The pipeline handles auto-resizing, denoising, and compression into the WebP format for optimal storage efficiency.
- **Optical Character Recognition (OCR):** The system utilizes Tesseract OCR to extract text from book covers when a barcode is unavailable. The extracted text is then cross-referenced against external book metadata databases.
- **Barcode Detection:** For structured identification, the pipeline integrates PyZbar to rapidly parse ISBN barcodes, ensuring high-accuracy data retrieval.

### Recommendation Engine and Semantic Search
BookLens employs a sophisticated machine learning approach to book discovery, moving beyond basic genre filtering:
- **Vector Embeddings:** The recommendation system is powered by HuggingFace SentenceTransformers. Both users and books are mapped into a high-dimensional vector space, allowing the system to calculate cosine similarities between user reading histories and potential recommendations.
- **Explicit Preference Re-ranking:** To address the cold-start problem and ensure high relevance, the algorithm applies score boosting based on explicit user preferences such as preferred authors, genres, and languages stored in the database.
- **Dynamic Re-evaluation:** As users interact with their library, their semantic profiles are continuously re-calculated, ensuring recommendations evolve alongside their reading habits.

### Library State Management
The application provides robust state management for personal libraries:
- Users can track books across distinct relational states: Want to Read, Reading Now, Finished, and Favourited.
- The system supports granular interactions, allowing users to append personal ratings and detailed notes to specific library entries.

### User Authentication and Profile Management
- The system implements secure, token-based authentication using JWT.
- Profile management includes the ability to dynamically update display names and upload custom profile pictures.
- Avatar uploads are processed asynchronously, converted to efficient WebP formats, and stored in S3-compatible object storage. The frontend utilizes an optimistic React Context architecture to ensure UI updates are reflected instantaneously without requiring a page reload.

## Technology Stack

The application is built upon a scalable, containerized microservice architecture.

### Frontend Technologies
- **Framework:** Next.js 14 (React)
- **Styling:** Vanilla CSS and Tailwind CSS, utilizing a custom design system focused on glassmorphism and modern UI principles.
- **State Management:** React Context API optimized for optimistic UI updates.
- **Icons:** Lucide React

### Backend Technologies
- **Framework:** FastAPI (Python)
- **Database ORM:** SQLAlchemy (Async) for high-performance, non-blocking database operations.
- **Machine Learning:** HuggingFace SentenceTransformers and PyTorch.
- **Image Processing:** OpenCV, Pillow, PyTesseract, and PyZbar.
- **Object Storage Client:** boto3 (S3-compatible)

### Infrastructure and Storage
- **Relational Database:** PostgreSQL with pgvector extension for vector similarity search.
- **Object Storage:** S3-compatible storage for persistent avatar and book scan storage.
- **Caching:** Redis for API rate limiting and session management.
- **Containerization:** Docker and Docker Compose for local development orchestration.

## Deployment

The application is deployed across a set of free-tier managed cloud services, each handling a specific layer of the infrastructure.

### Services Used

| Layer | Service | Notes |
|---|---|---|
| PostgreSQL Database | Supabase | Free tier with pgvector extension support |
| Object Storage | Supabase Storage | S3-compatible, 1GB free |
| Redis Cache | Upstash | Serverless Redis, 10,000 requests/day free |
| Backend API | Render | Free tier Web Service running Docker |
| Frontend | Vercel | Hobby tier, free Next.js hosting |

### Step 1: Database — Supabase
1. Create a free project at [Supabase](https://supabase.com/).
2. Go to **Settings > Database** and copy the PostgreSQL Session Pooler connection string.
3. Enable the pgvector extension in the SQL Editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Use this connection string for `DATABASE_URL` (with `postgresql+asyncpg://` protocol for the async driver) and `DATABASE_URL_SYNC` (with `postgresql://` protocol).
5. If your database password contains special characters such as `@`, you must percent-encode them (e.g., replace `@` with `%40`) in the connection string.

### Step 2: Object Storage — Supabase Storage
1. In your Supabase project, navigate to **Storage** and create a new public bucket named `booklens-storage`.
2. Go to **Storage > S3 Connection** and generate a new Access Key.
3. Use the provided S3 Endpoint, Access Key, and Secret Key for the `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, and `MINIO_SECRET_KEY` environment variables.
4. Set `MINIO_SECURE=true` since Supabase Storage uses HTTPS.

### Step 3: Redis Cache — Upstash
1. Create a free Redis database at [Upstash](https://upstash.com/).
2. From the database dashboard, select the **TCP** connection tab.
3. Copy the `rediss://...` connection string and use it as your `REDIS_URL`.

### Step 4: Backend API — Render
1. Create a new Web Service at [Render](https://render.com/) and connect your GitHub repository.
2. Set the **Language** to `Docker`.
3. Leave the **Root Directory** blank.
4. Set the **Dockerfile Path** to `infrastructure/docker/Dockerfile.api`.
5. Add all required environment variables: `DATABASE_URL`, `DATABASE_URL_SYNC`, `REDIS_URL`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`, `MINIO_SECURE`, `SECRET_KEY`, and `CORS_ORIGINS`.
6. Deploy. Render will provide a public `https://your-api.onrender.com` URL.

> Note: The free tier on Render will spin down after 15 minutes of inactivity. The first request after a period of inactivity may take up to 50 seconds to respond while the container restarts.

### Step 5: Frontend — Vercel
1. Import your GitHub repository at [Vercel](https://vercel.com/).
2. Set the **Framework Preset** to `Next.js`.
3. Set the **Root Directory** to `apps/web`.
4. Add the `NEXT_PUBLIC_API_URL` environment variable, setting its value to the Render API URL from Step 4.
5. Deploy. Vercel will provide a free `https://your-project.vercel.app` URL.

### Environment Variable Reference

The following environment variables must be configured on the backend host (Render):

| Variable | Description |
|---|---|
| `DATABASE_URL` | Async PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `DATABASE_URL_SYNC` | Sync PostgreSQL connection string (`postgresql://...`) |
| `REDIS_URL` | Upstash Redis connection string (`rediss://...`) |
| `MINIO_ENDPOINT` | S3-compatible storage endpoint hostname and path |
| `MINIO_ACCESS_KEY` | S3 storage access key |
| `MINIO_SECRET_KEY` | S3 storage secret key |
| `MINIO_BUCKET_NAME` | Storage bucket name (e.g., `booklens-storage`) |
| `MINIO_SECURE` | Set to `true` for HTTPS storage connections |
| `SECRET_KEY` | A long, random string used to sign JWT tokens |
| `CORS_ORIGINS` | Allowed frontend origins in JSON array format (e.g., `["https://your-app.vercel.app"]`) |

The following environment variable must be configured on the frontend host (Vercel):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | The public URL of your deployed Render backend |
