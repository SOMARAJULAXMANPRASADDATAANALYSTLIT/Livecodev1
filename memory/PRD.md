# Live Code Mentor - Product Requirements Document

## Original Problem Statement
AI-powered educational platform providing personalized, real-time coding assistance and English language learning through multimodal interactions.

## Architecture
- **Frontend**: React 18 with Monaco Editor, Framer Motion, React Markdown, Web Speech API
- **Backend**: FastAPI with Gemini 3 Flash via Emergent LLM Key
- **Database**: MongoDB (available but stateless for Phase 1)

## User Personas
1. **Beginner Coder** - CS students learning programming
2. **Non-Native English Speaker** - Professionals improving English
3. **Visual Learner** - Students who learn through diagrams

## Core Requirements (Static)
- Code Analysis with bug detection
- Teaching mode with pedagogical explanations
- Visual SVG diagram generation
- English conversational chat
- Grammar correction
- Image analysis (code screenshots, whiteboard)

## What's Been Implemented (January 26, 2026)

### Phase 1 - Core MVP
- [x] Complete FastAPI backend with 8 API endpoints
- [x] Code Learning Mode with Monaco Editor
- [x] Real-time code analysis and bug detection
- [x] Teaching overlay with concept explanations
- [x] Deeper explanations with code examples
- [x] Visual SVG diagram generation
- [x] Student understanding evaluation
- [x] English Learning chat interface
- [x] Intent detection (question/practice/conversation)
- [x] Grammar corrections display
- [x] Image upload modal with task types
- [x] Multimodal image analysis
- [x] Mode switching between Code/English
- [x] Responsive dark theme UI
- [x] Glassmorphism design elements

### Phase 2 - AI Senior Features (January 26, 2026)
- [x] SQL language support (+ TypeScript, C#, PHP)
- [x] **AI Senior Fix** - Auto-fix code with one click
- [x] **Split View** - Original code vs AI-fixed code side by side
- [x] Fix explanation with list of changes made
- [x] "Apply Fix" button to use the corrected code
- [x] Copy fixed code to clipboard
- [x] **Voice Input** - Talk to English Assistant (Web Speech API)
- [x] **Voice Output** - AI speaks responses aloud
- [x] Voice On/Off toggle
- [x] Real-time speech-to-text transcription

## Prioritized Backlog

### P0 (Critical) - DONE
- All core features + AI Senior implemented

### P1 (High Priority)
- User authentication and progress tracking
- Chat history persistence
- Screen sharing for live code review

### P2 (Medium Priority)
- Code execution sandbox
- Achievement badges
- Collaborative features

### P3 (Nice to Have)
- Mobile app versions
- Offline mode
- Custom model fine-tuning

## Next Tasks
1. Add user authentication (JWT or Google OAuth)
2. Implement progress tracking dashboard
3. Add screen sharing capability
4. Persist chat history to MongoDB
5. Add code execution feature
