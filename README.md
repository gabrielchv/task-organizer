# Task Organizer

A Next.js application for task management with voice recognition capabilities.

## Technologies

- Next.js 16.1.3
- React 19.2.3
- TypeScript
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Google Generative AI (Gemini)
- Vosk Browser (speech recognition)

## Setup

1. Install dependencies:
```
npm install
```

2. Create a `.env.local` file in the root directory with:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

3. Run the development server:
```
npm run dev
```

## Deployment

The application is deployed on Google Cloud Platform, originally accessible at task-organizer.gazerah.com.

### Google Cloud Deployment

The project includes a Dockerfile configured for Google Cloud Run deployment. The application uses standalone output mode for optimized container builds.

To deploy to Google Cloud Run:

```
gcloud run deploy task-helper-next --source . --region us-central1 --allow-unauthenticated --set-env-vars GEMINI_API_KEY="your_gemini_api_key"
```

This command builds and deploys the application from the current directory, sets the service to allow unauthenticated access, and configures the GEMINI_API_KEY environment variable.

### Vosk Model Deployment

Vosk speech recognition models must be deployed to a public Google Cloud Storage bucket. The models are located in `public/model/` directory:

- `public/model/en/model.tar.gz` - English model
- `public/model/pt/model.tar.gz` - Portuguese model

To configure CORS for the bucket, use:
```
gsutil cors set cors.json gs://task-organizer-assets
```

The bucket must be publicly accessible to allow the browser to fetch model files.

## Firebase Configuration

The application uses Firebase for authentication and data storage:
- Firebase Authentication for user management
- Cloud Firestore for storing user task data

Firebase configuration is set in `app/lib/firebase.ts`.

## Build

Build the production version:
```
npm run build
```

Start the production server:
```
npm start
```
