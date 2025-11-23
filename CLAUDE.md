# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Seat-Finder is a mobile-friendly seat-lookup app for the wedding of Mahek & Saumya in Newport News, VA. The app allows guests to:
- Scan a QR code to access the app
- Search for their name
- View their assigned table number
- See their seating highlighted on a visual floor map

**Key Requirements:**
- High throughput during reception check-ins
- Minimal friction for event staff
- Mobile-first design
- Fast name search functionality
- Visual floor map with seat highlighting

## Architecture Notes

This is a new repository. When implementing the application, consider:

1. **Frontend Framework**: Choose a mobile-first framework (React, Vue, or similar) optimized for quick load times on mobile devices
2. **Search Functionality**: Implement fuzzy search to handle name variations and typos during high-stress check-in scenarios
3. **Data Structure**: Guest list with name-to-table mappings; floor map coordinates for seat highlighting
4. **Offline Capability**: Consider offline-first approach to ensure reliability during the event regardless of venue connectivity
5. **QR Code Integration**: QR code should deep-link directly to the app, potentially pre-filling venue/event context

## Development Workflow

Since this repository is in early stages, establish:
- Build and test commands in package.json
- Linting and formatting standards
- Deployment strategy (likely static hosting for a simple web app)
- Guest data structure and sample data for testing
- Can you use these please