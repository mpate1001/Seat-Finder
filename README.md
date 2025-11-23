# Seat-Finder

A streamlined, mobile-friendly seat-lookup app built for the wedding of Mahek & Saumya in Newport News, VA. Guests can scan a QR code or NFC tag, search their name, and instantly view their assigned table number with a personalized message.

## Features

- **QR Code & NFC Integration**: Quick access via scan or tap
- **Real-time Google Sheets Integration**: Guest data automatically synced from a published Google Sheet
- **Smart Search**: Real-time search by first and last name with fuzzy matching
- **Unique Guest Identification**: Displays contact info or custom description to distinguish guests with identical names
- **Beautiful Table Assignment Display**: Animated popup showing table number and personalized message
- **Mobile-First Design**: Optimized for phones and tablets with touch-friendly interface
- **Modern Tech Stack**: Built with React, TypeScript, and Vite for fast performance

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Custom CSS with mobile-responsive design
- **Data Source**: Google Sheets (CSV export)
- **Color Palette**: Space Indigo, Lavender Grey, Platinum, Punch Red, Flag Red

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Google Sheets Setup

The app pulls guest data from a published Google Sheet with the following structure:

| Column A | Column B | Column C | Column D | Column E |
|----------|----------|----------|----------|----------|
| Table Number | First Name | Last Name | Contact Info | Guest Description |

**Example Data:**
```
5, John, Smith, john.smith@email.com, Groom's college roommate
3, Sarah, Johnson, 757-555-0123, Bride's cousin from Richmond
```

To connect your own Google Sheet:
1. Create a Google Sheet with the columns above
2. Publish it to the web (File → Share → Publish to web → CSV)
3. Update the `SHEET_URL` in `src/services/googleSheets.ts` with your published URL

## Project Structure

```
src/
├── components/
│   ├── SearchForm.tsx        # First/Last name search inputs
│   ├── SearchForm.css
│   ├── GuestDropdown.tsx     # Search results with unique identifiers
│   ├── GuestDropdown.css
│   ├── TableModal.tsx        # Table assignment popup
│   └── TableModal.css
├── services/
│   └── googleSheets.ts       # Google Sheets CSV fetching & parsing
├── App.tsx                   # Main application component
├── App.css
├── main.tsx                  # Entry point
├── index.css                 # Global styles
└── types.ts                  # TypeScript interfaces
```

## Color Palette

The app uses a sophisticated navy and red color scheme:

- **Space Indigo** (#2b2d42): Primary text, headers, buttons
- **Lavender Grey** (#8d99ae): Backgrounds, hover states
- **Platinum** (#edf2f4): Borders, subtle backgrounds
- **Punch Red** (#ef233c): Accents, table display
- **Flag Red** (#d90429): Hover states, gradients

## Development

The app is configured with:
- TypeScript strict mode for type safety
- ESLint for code quality
- Hot module replacement for fast development
- Mobile-responsive design with iOS-specific optimizations

## Future Enhancements (v2)

- [ ] Interactive venue floor map with table highlighting
- [ ] Offline support with service workers
- [ ] QR code generation for easy deployment
- [ ] Analytics for tracking guest check-ins
- [ ] Admin panel for real-time guest list updates

## License

Private project for Mahek & Saumya's wedding.

---

Built with ❤️ for Mahek & Saumya's special day!
