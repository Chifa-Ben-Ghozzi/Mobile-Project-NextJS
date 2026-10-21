# RideShare [![Netlify Status](https://api.netlify.com/api/v1/badges/3c958cfa-2c19-4c63-9cdb-d5a09d003b81/deploy-status)](https://app.netlify.com/sites/rideshareappweb/deploys)

RideShare is a modern, user-friendly web application that facilitates ride-sharing among users. It allows people to connect, offer, and request rides within their trusted network of contacts.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Features

- User authentication and registration
- Create, view, edit, cancel, and delete ride-request announcements with passenger, price, luggage, pet, smoking, accessibility, vehicle, and driver-gender criteria
- Manage active cars and attach a saved vehicle profile to each ride offer
- Publish and manage independent driver trip offers with route, departure time, price, places, pickup details, and message
- Offer rides to other users
- Browse open ride requests as any signed-in user
- Real-time notifications for ride updates
- User profile management
- Reclamations for ride/service, safety, conduct, account, and payment issues, with status tracking
- Contact list and suggestions
- Interactive map for location selection
- Responsive design for mobile and desktop
- Dark mode support
- Offline capabilities
- Push notifications (on supported browsers)
- In-app help assistant for guidance on using RideShare features

## Technologies Used

- [Next.js 15](https://nextjs.org/) with App Router
- [React 18](https://reactjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.io/) for database
- [MapTiler](https://www.maptiler.com/) for map services
- [Framer Motion](https://www.framer.com/motion/) for animations
- [Lucide React](https://lucide.dev/) for icons
- [next-themes](https://github.com/pacocoursey/next-themes) for theming
- [Vercel](https://vercel.com/) for deployment

## Getting Started

### Prerequisites

- Node.js 18.18 or later (Node.js 20 LTS recommended)
- npm
- A Supabase project

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/FelixRobb/ride-share-app.git
   cd ride-share-app
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Copy `.env.example` to `.env.local`:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Fill in the values using your own service accounts:

   - **Required:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `GMAIL_USER`, and `GMAIL_PASS`.
   - **Optional integrations:** `NEXT_PUBLIC_MAPTILER_KEY` enables maps; the VAPID keys enable push notifications; `NEXT_PUBLIC_CONTACT_EMAIL` sets the contact address.
   - Set `ADMIN_PASSWORD` if you need to use the admin dashboard.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` is used by the welcome page. It is a public client key; never expose the service-role key.

   Generate separate random values for `NEXTAUTH_SECRET` and `JWT_SECRET` with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Set `NEXT_PUBLIC_APP_URL` to `https://localhost:3000` for local development. Use a Gmail App Password for `GMAIL_PASS`. Never commit `.env.local` or share real credentials in the repository; each developer should use their own credentials.

4. In the Supabase SQL editor, run [`database.sql`](./database.sql) against your development Supabase project to create or update the required tables and database functions. Avoid running it against a production database when setting up locally.

   If the database was already initialized, run the updated SQL script to add the `reclamations` table.

5. Start the development server:

   ```bash
   npm run dev
   ```

   Open [https://localhost:3000](https://localhost:3000). The development server uses HTTPS; your browser may show a warning for its local development certificate.

### Build and run for production

```bash
npm run lint
npm run build
npm start
```

The production server starts at `http://localhost:3000`. The repository does not currently define a dedicated test script.

### Sharing changes with the team

Push the application source, public assets, `database.sql`, `package.json`, `package-lock.json`, `.env.example`, and this README. The lockfile keeps dependency installs consistent. Do not push `.env.local`, real API keys/passwords, `node_modules`, `.next`, or generated local certificates. These local files are excluded by `.gitignore`.

After cloning and pulling the shared branch, each teammate should follow the installation steps above and configure their own `.env.local` and Supabase development project.

## Usage

1. Register for an account or log in if you already have one.
2. Set up your profile and add contacts.
3. Create a ride request by specifying the route, date, passenger count, and any optional ride criteria.
4. Browse open ride requests from all signed-in users and offer rides to others.
5. Manage your rides from the dashboard.
6. Receive notifications for ride updates and new requests.
7. Use **Offer a Ride** in the navigation to publish and manage independent driver trips; active offers are visible to signed-in users.
8. Choose **Reclamation** in the navigation to submit and track an issue. Pending submissions can be edited or deleted; the team can respond and update the status.

## Project Structure

- `src/app/`: Next.js App Router pages and API routes
- `src/components/`: Reusable React components
- `src/contexts/`: React context providers
- `src/hooks/`: Custom React hooks
- `src/lib/`: Database, auth, and feature services
- `public/`: Static assets
- `src/types/`: TypeScript type definitions
- `src/utils/`: Helper functions and API calls

## API Endpoints

- `/api/login`: User login
- `/api/register`: User registration
- `/api/rides`: CRUD operations for rides
- `/api/contacts`: Manage user contacts
- `/api/notifications`: Handle user notifications
- `/api/users`: User-related operations

For a complete list of API endpoints and their usage, please refer to the API documentation.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

Félix Robb - [rideshareapp.mail@gmail.com](rideshareapp.mail@gmail.com)

Github Project Link: [https://github.com/FelixRobb/ride-share-app/](https://github.com/FelixRobb/ride-share-app/)
