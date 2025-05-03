# README – CodeConnect Final Year Project

## Contents

This submission includes the full source code for my final year project, **CodeConnect**, as well as this README to explain the contents and limitations regarding execution.

## Directory Structure

- **src/** - Contains all frontend components, layouts, and client-side logic
  - **services/** - Frontend service modules and utilities

- **pages/api/** - Backend API endpoints and serverless functions

- **public/** - Static assets including images, icons, and resources

- **Root Directory** - Configuration files for project setup:
  - Package management (package.json, package-lock.json)
  - Next.js configuration (next.config.js)
  - Environment setup (.env.example)
  - Build and deployment configurations

## Execution Notes

Unfortunately, the submitted code **cannot be run directly** by examiners due to the following reasons:

- **Environment Variables Not Included**  
  The project relies on sensitive environment variables (e.g., GitHub OAuth keys, Supabase service keys, webhook secrets) which have **not been included** for security and privacy reasons.

- **Hosting Dependencies**  
  Several features are tightly integrated with the hosted environment:
  - GitHub OAuth requires specific callback URLs
  - Webhook endpoints rely on configured domain routes
  - Supabase usage is linked to my hosted instance

Without these configurations, some key features such as authentication, real-time updates, and external API integrations will not work locally.

## Hosted
The website is hosted at https://www.codeconnect.cc/
