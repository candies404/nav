# NavSphere - Website Navigation Platform

<p align="center">
  <strong>Modern Website Navigation Management Platform</strong>
</p>

<p align="center">
  <a href="./README.md">简体中文</a> | <strong>English</strong>
</p>

<p align="center">
  <a href="https://github.com/tianyaxiang/NavSphere/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/tianyaxiang/NavSphere?style=flat-square"></a>
  <a href="https://github.com/tianyaxiang/NavSphere/network"><img alt="GitHub forks" src="https://img.shields.io/github/forks/tianyaxiang/NavSphere?style=flat-square"></a>
  <a href="https://github.com/tianyaxiang/NavSphere/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/tianyaxiang/NavSphere?style=flat-square"></a>
  <a href="https://github.com/tianyaxiang/NavSphere/blob/main/LICENSE"><img alt="GitHub license" src="https://img.shields.io/github/license/tianyaxiang/NavSphere?style=flat-square"></a>
</p>

## 📖 Introduction

NavSphere is a modern website navigation management platform built with Next.js 15. Designed for website collection, categorization, and management, it provides a secure and reliable navigation data management experience using Upstash Redis as the data storage backend.

### Core Feature

#### 🔖 Website Navigation
Comprehensive website bookmark management system to help you collect and organize commonly used websites, online tools, and resources.

### Core Highlights

- 🔖 **Website Navigation Management**: Collect and manage your favorite websites and online tools
- 📊 **Category Management**: Flexible category and subcategory system with unlimited hierarchy
- 🎨 **Modern Interface**: Beautiful UI based on Radix UI and Tailwind CSS
- 🔐 **Password Authentication**: Configure the admin password with `ADMIN_PASSWORD`
- 📱 **Responsive Design**: Perfect adaptation for desktop and mobile
- 🌓 **Theme Switching**: Support for dark/light themes
- 🎯 **Smart Icons**: Automatically fetch website Favicons
- ⚡ **High Performance**: Support for Cloudflare Pages edge deployment

## ✨ Core Features

### Website Navigation

- 🔖 **Website Collection**: Quickly collect and manage your favorite websites
- 📂 **Category Organization**: Create main categories and subcategories with unlimited hierarchy
- 🎨 **Smart Icons**: Automatically fetch website Favicons or manually upload
- 📝 **Detailed Description**: Add title, description, and other information for each website
- 🔍 **Quick Search**: Quickly locate websites through keywords
- 🎯 **One-Click Access**: Click to jump to the target website
- 🏷️ **Tag Management**: Better organize content using icons and tags
- 🔄 **Drag & Drop Sorting**: Freely adjust the display order of websites and categories

### Admin Dashboard

- 👨‍💼 **Unified Management**: Website navigation admin system
- ➕ **Quick Add**:
  - **Websites**: Enter URL to automatically fetch website information
- ✏️ **Edit Features**:
  - Modify title, description, and icons
  - Adjust category attribution
  - Upload custom icons
- 🗂️ **Category Management**: Create, edit, and delete categories and subcategories
- 📊 **Visual Editing**: Monaco Editor supports direct JSON data editing
- 🔍 **Smart Search**: Quickly locate content and categories
- 🎨 **Icon Selection**: Integrated Lucide Icons library

### Technical Features

- 🚀 **Modern Tech Stack**: Next.js 15 + React 18 + TypeScript
- 🎨 **UI Component Library**: Radix UI + shadcn/ui
- 🎭 **Icon System**: Lucide React icon library
- 📦 **State Management**: React Query for data fetching and caching
- 🔧 **Form Handling**: React Hook Form + Zod validation
- 🌐 **Data Storage**: Upstash Redis as data backend
- 🔐 **Authentication**: NextAuth.js v5 Credentials authentication

## 🛠️ Tech Stack

| Technology          | Version       | Purpose                      |
| ------------------- | ------------- | ---------------------------- |
| **Next.js**         | 15.5.7        | React full-stack framework   |
| **React**           | 18.2.0        | User interface library       |
| **TypeScript**      | 5.1.6         | Type-safe JavaScript         |
| **Tailwind CSS**    | 4.1.12        | Atomic CSS framework         |
| **NextAuth.js**     | 5.0.0-beta.25 | Authentication solution      |
| **Radix UI**        | Latest        | Accessible UI component lib  |
| **Lucide React**    | 0.462.0       | Modern icon library          |
| **React Query**     | 5.62.2        | Data fetching & state mgmt   |
| **React Hook Form** | 7.53.2        | Form handling                |
| **Zod**             | 3.25.76       | Data validation              |
| **Monaco Editor**   | 0.52.2        | Code editor                  |

## 🚀 Quick Start

### Requirements

- Node.js 20.0+
- pnpm 8.0+ (recommended) or npm/yarn
- Upstash Redis database

### Installation

1. **Clone the project**
```bash
git clone https://github.com/tianyaxiang/NavSphere.git
cd NavSphere
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Configure environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` file and configure the necessary environment variables (see configuration guide below)

4. **Start development server**
```bash
pnpm dev
```

5. **Access the application**
   
   Open your browser and visit [http://localhost:3000](http://localhost:3000)

## ⚙️ Configuration Guide

### Environment Variables

Create a `.env.local` file and configure the following variables:

```env
# Admin password
ADMIN_PASSWORD=change-this-admin-password

# Upstash Redis REST configuration
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-rest-token
UPSTASH_REDIS_KEY_PREFIX=navsphere

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=your-random-auth-secret
NEXT_PUBLIC_API_URL=http://localhost:3000

# Google Analytics Configuration (Optional)
GA_ID=your-google-analytics-id
```

### Upstash Redis Setup

1. Create a Redis database in Upstash.
2. Copy the database `REST URL` and `REST TOKEN` to `.env.local`.
3. Set a strong `ADMIN_PASSWORD`.
4. If Redis has no data on first read, the app uses the bundled JSON as defaults. After saving in the admin dashboard, data is written to Redis.

## 📊 Data Structure

### navigation.json - Website Navigation Data Format

Website navigation data storage format:

```json
{
  "navigationItems": [
    {
      "id": "category-id",
      "title": "Recommended",
      "icon": "Star",
      "description": "Common websites and tools",
      "enabled": true,
      "items": [
        {
          "id": "item-id",
          "title": "Website Name",
          "href": "https://example.com",
          "description": "Website Description",
          "icon": "/assets/images/logos/example.webp",
          "enabled": true
        }
      ],
      "subCategories": [
        {
          "id": "sub-category-id",
          "title": "Subcategory Name",
          "icon": "BookOpen",
          "description": "Subcategory Description",
          "enabled": true,
          "items": [
            {
              "id": "sub-item-id",
              "title": "Website Name",
              "href": "https://example.com",
              "description": "Website Description",
              "icon": "/assets/favicon.webp",
              "enabled": true
            }
          ]
        }
      ]
    }
  ]
}
```

## 🚀 Deployment Guide

### Cloudflare Pages Deployment (Recommended)

1. **Create Project**
   - Log in to [Cloudflare Pages](https://pages.cloudflare.com/)
   - Connect your project repository

2. **Build Settings**
   ```bash
   # Build command
   pnpm install && pnpm run cf:build
   
   # Output directory
   .next
   
   # Node.js version
   20.0.0
   ```

3. **Environment Variables Configuration**
   
   Add all required environment variables in Cloudflare Pages

4. **Custom Deployment**
   ```bash
   # Local build and deploy
   pnpm run cf:deploy
   ```

### Vercel Deployment

1. **One-Click Deployment**
   - Click the "Deploy with Vercel" button
   - Configure required environment variables

2. **Manual Deployment**
   - Fork the project to your GitHub
   - Import the project in Vercel
   - Configure environment variables
   - Deploy the project

### Docker Deployment

```bash
# Build image
pnpm run docker:build

# Development environment
pnpm run docker:dev

# Production environment
pnpm run docker:prod

# View logs
pnpm run docker:logs

# Stop service
pnpm run docker:stop
```

## 🔧 Development Guide

### Available Scripts

```bash
# Development mode
pnpm dev

# Build project
pnpm build

# Start production server
pnpm start

# Code linting
pnpm lint

# Clean build files
pnpm clean

# Cloudflare Pages deployment
pnpm run cf:build
pnpm run cf:deploy

# Docker deployment
pnpm run docker:build
pnpm run docker:dev
pnpm run docker:prod
```

### Project Structure

```
NavSphere/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   └── navigation/    # Website navigation API
│   │   ├── admin/             # Admin dashboard
│   │   │   └── navigation/    # Website management
│   │   └── components/        # Page components
│   ├── components/            # Shared UI components
│   │   ├── navigation-card.tsx # Website card
│   │   └── navigation-content.tsx # Website content
│   ├── lib/                   # Utility functions
│   ├── types/                 # TypeScript type definitions
│   │   └── navigation.ts      # Navigation types
│   ├── services/              # Service layer
│   └── navsphere/             # Data files
│       └── content/
│           ├── navigation.json # Website navigation data
│           └── site.json      # Site configuration
├── public/                    # Static assets
│   └── assets/
│       └── images/
│           └── logos/         # Website icons
├── docker/                    # Docker configuration
└── wrangler.toml             # Cloudflare configuration
```

## 🎯 Usage Guide

### Website Navigation

#### Adding Websites

1. Log in to admin dashboard at `/admin/navigation`
2. Click "Add Navigation Category" or "Add Website" in an existing category
3. Enter the website URL
4. The system will automatically fetch:
   - Website title
   - Website description
   - Website Favicon
5. Manually edit title and description
6. Upload custom icon (optional)
7. Save the website

#### Website Category Management

1. **Create Category**:
   - Click "Add Navigation Category" in the admin dashboard
   - Enter category name and description
   - Select an appropriate icon from Lucide Icons
   - Save the category

2. **Create Subcategory**:
   - Add subcategories under main categories
   - Support unlimited hierarchy of categories
   - Each subcategory can have its own icon and description

3. **Adjust Order**:
   - Use drag and drop to adjust the display order of categories and websites
   - Support cross-category dragging

4. **Batch Management**:
   - Use Monaco Editor to directly edit JSON data
   - Support batch import and export

### Common Features

#### Icon Management

**Lucide Icons**:
- Full Lucide icon library integration
- Available icons: Home, Star, BookOpen, Brain, Code, etc.
- Visit [lucide.dev](https://lucide.dev/) to view all available icons

**Custom Icons**:
- Support upload of PNG, SVG, WebP formats
- Recommended size: 256x256 pixels
- Automatic optimization and compression

#### Search Function

1. Use the search box on the homepage
2. Support searching:
   - Website titles
   - Description content
   - Category names
3. Real-time search results display

## 🐛 Troubleshooting

### Common Issues

**Authentication Failure**
- Check that `ADMIN_PASSWORD` is configured and entered correctly
- Check that `AUTH_SECRET` is configured

**Data Loading Failure**
- Verify that `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct
- Check that the Upstash Redis database is reachable
- Confirm the Redis data format is correct; if no data exists, the app falls back to bundled JSON defaults

**Build Failure**
- Check Node.js version (requires 20.0+)
- Clean dependencies: `rm -rf node_modules pnpm-lock.yaml && pnpm install`
- Check environment variable configuration

## 🤝 Contributing

We welcome all forms of contribution!

1. Fork the project
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push the branch: `git push origin feature/amazing-feature`
5. Create a Pull Request

## 📄 License

This project is open-sourced under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - Powerful React framework
- [Tailwind CSS](https://tailwindcss.com/) - Excellent CSS framework
- [Radix UI](https://www.radix-ui.com/) - Accessible component library
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Cloudflare Pages](https://pages.cloudflare.com/) - Reliable deployment platform
- All developers who contributed to the project

---

<p align="center">
  <strong>⭐ If this project helps you, please give us a Star!</strong>
</p>
