# ⚡ Rally ACU — Candidate Interview & Admission Tool

A modern web application built for **Rally Ahram Canadian University (ACU)** Season 2026–2027 to manage applicant interviews, technical committee evaluations, and HR admission decisions.

Designed with the exact branding, dark-mode glassmorphic aesthetic, red glowing accents, and typography of the official site: [rally-acu.vercel.app](https://rally-acu.vercel.app).

---

## 🔒 Cryptographic Access System

Access credentials are fixed and cryptographically hashed in the client-side authentication engine using **salted SHA-256** digests and **AES-GCM** encryption. No plaintext emails or passwords exist in the source code.

---

## 🚀 Key Features

1. **Rally ACU Visual Theme**:
   - Deep obsidian background (`#060810`) with floating ambient blur orbs in red (`#f43f5e`), blue, and gold.
   - Glassmorphism containers (`backdrop-filter: blur(16px)`).
   - Plus Jakarta Sans + Inter typography.
   - Light and Dark mode instant toggle.

2. **Committee & HR Interview Tracking**:
   - Quick one-click status toggles for **Committee Interview** (`Accepted`, `Pending`, `Rejected`).
   - Quick one-click status toggles for **HR Interview** (`Accepted`, `Pending`, `Rejected`).
   - Dynamically derived overall admission status:
     - `Fully Accepted 🎉` (both approved)
     - `Committee Accepted, Awaiting HR`
     - `HR Accepted, Awaiting Committee`
     - `In Review` (pending)
     - `Rejected`

3. **Committee Heads Experience**:
   - When a committee head logs in (e.g. Ahmed Talaat for Media), the sheet automatically filters to their committee applicants and dynamically labels the interview column (e.g. *Media Interview*).
   - Mariam (Admin / Talent Management) has universal oversight over all committees and HR statuses.

4. **Add Candidate & Full Evaluation Rubric**:
   - **Add Candidate Modal**: Add new applicants with University details (Faculty, Academic Year, WhatsApp, Choice 1 & 2).
   - **Evaluation Modal**: Score candidates (1 to 10) and record qualitative feedback for both technical and HR evaluations.

5. **Search & Data Portability**:
   - Real-time search across candidate names, faculties, phones, and emails.
   - **Export to CSV / Excel** with complete UTF-8 support.
   - **JSON Backup / Restore** for data portability.
   - **Persistence in LocalStorage** pre-seeded with realistic Season 26/27 candidates.

---

## 💻 How to Run

Simply open [index.html](file:///d:/Rally%20Interview%20Tool/index.html) in any modern web browser (Google Chrome, Microsoft Edge, Brave, Firefox, etc.). No build step or installation required!
