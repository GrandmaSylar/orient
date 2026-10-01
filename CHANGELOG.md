# Changelog

All notable changes to the Orient Fees Tracker system are documented below in plain, simple language.

---

## [1.2.1] - 2026-10-01

### Added & Improved
* **Compact Daily Report Layout:** Restructured daily collection ledger reports into single consolidated tables per fee category with inline class banner rows, drastically reducing font sizes, line spacing, and total printable page count.
* **Top-Aligned Header & Single-Line Meta Bar:** Combined title, academic year, term, and date details into a space-saving horizontal header bar with compact logo sizing.
* **Seamless Multi-Page Table Flows:** Optimized page break rules to break cleanly across individual table rows without dropping large empty white spaces at page bottoms.

---

## [1.2.0] - 2026-08-27

### Added
* **Live Layout Adjustments:** Added a styling toolbar inside all receipt and report preview windows. You can now use a slider or type in a size directly to change font size, and use a checkbox to toggle extra bold text.
* **Instant Preview Updates:** The print preview screen now redraws instantly and smoothly as you adjust the sizing or bold settings.
* **Centered-Top Receipt Alignment:** Receipts are now centered horizontally on paper while starting at the very top of the page vertically, removing unwanted white space.
* **Standardized Receipt History:** Printing past receipts from student profiles now opens the same layout preview screen with sizing and bold toggles instead of printing instantly.

---

## [1.1.0] - 2026-08-25

### Added
* **Database Connection Indicator:** Added a visual connection status symbol at the top of the app to show if the database is connected and measure its signal speed.
* **Automated Data Backups:** Added a system script that automatically sets up a daily backup of your database records on Windows to prevent data loss.
* **Bulk Student Uploads:** Added support for importing student list spreadsheets directly into the database, eliminating the need to type them one-by-one.
* **Internal Security Scrambling:** Added automatic code scrambling to protect system security and license configuration settings when building final release packages.
