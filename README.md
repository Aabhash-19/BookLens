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
- **Vector Embeddings:** The recommendation system is powered by HuggingFace `SentenceTransformers`. Both users and books are mapped into a high-dimensional vector space, allowing the system to calculate cosine similarities between user reading histories and potential recommendations.
- **Explicit Preference Re-ranking:** To address the cold-start problem and ensure high relevance, the algorithm applies artificial score boosting based on explicit user preferences (e.g., preferred authors, genres, and languages) stored in the database.
- **Dynamic Re-evaluation:** As users interact with their library, their semantic profiles are continuously re-calculated in the background, ensuring recommendations evolve alongside their reading habits.

### Library State Management
The application provides robust state management for personal libraries:
- Users can track books across distinct relational states: Want to Read, Reading Now, Finished, and Favourited.
- The system supports granular interactions, allowing users to append personal ratings and detailed notes to specific library entries.

### User Authentication and Profile Management
- The system implements secure, token-based authentication.
- Profile management includes the ability to dynamically update usernames and upload custom profile pictures.
- Avatar uploads are processed asynchronously, converted to highly efficient WebP formats, and stored in an S3-compatible object storage system. The frontend utilizes an optimistic state architecture to ensure UI updates are reflected instantaneously without requiring a page reload.

## Technology Stack

The application is built upon a scalable, containerized microservice architecture.

### Frontend Technologies
- **Framework:** Next.js 14 (React)
- **Styling:** Vanilla CSS and Tailwind CSS, utilizing a custom design system focused on glassmorphism and modern UI principles.
- **State Management:** React Context API optimized for optimistic UI updates.

### Backend Technologies
- **Framework:** FastAPI (Python)
- **Database ORM:** SQLAlchemy (Async) for high-performance, non-blocking database operations.
- **Machine Learning:** HuggingFace `SentenceTransformers` and PyTorch.
- **Image Processing:** OpenCV, Pillow, PyTesseract, and PyZbar.

### Infrastructure and Storage
- **Relational Database:** PostgreSQL
- **Object Storage:** MinIO (S3-compatible storage utilized for persistent avatar and book scan storage).
- **Containerization:** Docker and Docker Compose for seamless orchestration across environments.

## Deployment Instructions

The application is fully containerized and designed to be deployed to any Docker-compatible hosting environment.

1. **Clone the Repository**
   Clone the repository to your production server.

2. **Environment Configuration**
   Duplicate the provided `.env.example` file to create a `.env` file. You must populate this file with your production database credentials, API keys, and secure cryptographic secrets for token generation.

3. **Container Orchestration**
   Execute the deployment via Docker Compose. The `--build` flag ensures that the latest source code is compiled into the production images, and the `-d` flag runs the services in the background.
   ```bash
   docker compose up -d --build
   ```

4. **Network Configuration**
   In a production environment, it is highly recommended to place the application behind a reverse proxy (such as Nginx or Traefik) and configure SSL/TLS certificates to secure API communications and user data. Ensure that the proxy correctly routes traffic to the respective Next.js frontend and FastAPI backend containers.
