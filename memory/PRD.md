# Live Code Mentor - Product Requirements Document

## Original Problem Statement
AI-powered educational platform providing personalized, real-time coding assistance, multi-industry AI agents, and a comprehensive learning path mentor system for lifelong learning.

## Architecture
- **Frontend**: React 19 with Monaco Editor, Framer Motion, React Markdown, Recharts
- **Backend**: FastAPI with Gemini 3 Flash via Emergent LLM Key
- **Database**: MongoDB (collections: sessions, projects, workspaces, learning_profiles, learning_progress)

## User Personas
1. **Beginner Coder** - CS students learning programming
2. **Career Changer** - Professionals switching to tech careers
3. **Non-Native English Speaker** - Professionals improving English
4. **Business Professional** - Analysts needing company research
5. **Health Enthusiast** - People wanting to understand medical concepts
6. **Travel Planner** - Users planning trips and itineraries

## Core Requirements

### Learning Path Mentor System (Enhanced - January 29, 2026)
- [x] 4-step onboarding wizard (Goal, Background, Style, Commitment)
- [x] Multi-industry skill trees (Software, Data, Business, Healthcare, Travel, Architecture)
- [x] Weekly learning plans with tasks and homework
- [x] Interactive AI mentoring sessions
- [x] Progress tracking and velocity metrics
- [x] Topic completion tracking with scores
- [x] Career fit analysis and personalized recommendations
- [x] **NEW: Editable Learning Topics** - Add custom topics with YouTube URLs
- [x] **NEW: YouTube Video Integration** - Watch videos with AI mentor companion
- [x] **NEW: Free Learning Resources** - Auto-curated YouTube videos & courses
- [x] **NEW: Video Learning Modal** - Embedded player with AI chat (Explain/Example/Quiz)

### Multi-Industry AI Agents (NEW - January 27, 2026)
- [x] **Coding Mentor Agent** - Full IDE + tutor for software development
- [x] **Health Agent** - Medical concepts, patient education with disclaimers
- [x] **Travel Agent** - Trip planning, itineraries, destination guides
- [x] **Business Intelligence Agent** - Company analysis, competitor research, HTML dashboards
- [x] Specialized result cards for each agent type
- [x] Quick Actions panel with agent-specific shortcuts
- [x] Chat interface with conversation history

### Core Features (Previously Implemented)
- [x] Code Analysis with bug detection
- [x] Teaching mode with pedagogical explanations
- [x] Visual SVG diagram generation
- [x] English conversational chat
- [x] Grammar correction
- [x] Image analysis (code screenshots, whiteboard)
- [x] AI Senior Fix with split view
- [x] Voice input/output for English learning
- [x] Project upload and analysis (IDE mode)

## What's Been Implemented

### January 29, 2026 - Editable Learning Path with YouTube Integration
- Created EditableLearningPath component (`/app/frontend/src/components/EditableLearningPath.jsx`)
- Users can **add custom topics** to their learning tree with "+ Add Topic" button
- Users can **add YouTube URLs** to any topic with "Add URL" button
- **Video preview** shows thumbnail and title when pasting YouTube URL
- **Free Learning Resources** section auto-curates YouTube videos and courses
- **Video Learning Modal** plays videos with AI mentor companion
- AI mentor uses video transcript to answer questions in real-time
- Backend APIs for custom learning paths:
  - POST /api/learning/paths/create
  - GET /api/learning/paths
  - POST /api/learning/paths/{path_id}/topics
  - PUT /api/learning/topics/{topic_id}
  - DELETE /api/learning/topics/{topic_id}
  - POST /api/learning/topics/{topic_id}/youtube
  - GET /api/learning/youtube/preview/{video_id}

### January 27, 2026 - Learning Path & Multi-Agent System
- Created comprehensive Learning Path Mentor view (`/app/frontend/src/components/LearningPathView.jsx`)
- Implemented 4-step onboarding wizard with industry selection
- Added skill tree visualization with nested topics
- Built weekly plan display with tasks and homework
- Created interactive mentoring sessions with AI
- Built progress dashboard with stats
- Enhanced Multi-Industry Agents UI (`/app/frontend/src/components/AgentsView.jsx`)
- Added specialized result cards for Health, Travel, and Business agents
- Implemented Quick Actions panel for each agent
- Added download functionality for business HTML reports
- Updated Header with 5 modes (Learning Path, AI Agents, IDE, Code, English)
- Added backend APIs for learning system:
  - POST /api/learning/onboard
  - POST /api/learning/mentor
  - POST /api/learning/complete-topic
  - GET /api/learning/progress/{user_id}

### January 26, 2026 - Phase 1 & 2
- Complete FastAPI backend with 25+ API endpoints
- Code Learning Mode with Monaco Editor
- Real-time code analysis and bug detection
- Teaching overlay with concept explanations
- Visual SVG diagram generation
- English Learning chat interface
- AI Senior Fix with split view
- Voice input/output
- IDE scaffolding with project upload

## API Endpoints

### Learning Path APIs
- `POST /api/learning/onboard` - Create personalized learning path
- `POST /api/learning/mentor` - Interactive tutoring session
- `POST /api/learning/complete-topic` - Mark topic as complete
- `GET /api/learning/progress/{user_id}` - Get user progress

### Multi-Industry Agent APIs
- `GET /api/agents` - List all available agents
- `POST /api/agent/chat` - Chat with any agent
- `POST /api/agent/health/explain` - Medical topic explanation
- `POST /api/agent/travel/plan` - Create travel itinerary
- `POST /api/agent/business/analyze` - Company analysis
- `POST /api/agent/html-report` - Generate HTML dashboard

### Core APIs
- `POST /api/analyze-code` - Analyze code for bugs
- `POST /api/fix-code` - AI Senior fix
- `POST /api/line-mentoring` - Line-level mentoring
- `POST /api/generate-teaching` - Teaching explanations
- `POST /api/generate-visual-diagram` - SVG diagrams
- `POST /api/english-chat` - English learning
- `POST /api/upload-project` - Project upload
- `POST /api/project/{id}/run` - Run project

## Prioritized Backlog

### P0 (Critical) - DONE
- All core features implemented
- Learning Path Mentor system complete
- Multi-Industry Agents complete
- Editable Learning Topics with YouTube integration
- Video Learning Modal with AI companion

### P1 (High Priority) - Pending
- Moltbot full clone implementation (WhatsApp, Telegram, Discord integrations)
- Full IDE implementation (file explorer, editor tabs, terminal)
- Gemini Live API integration (real-time audio/video mentoring)
- Full project execution in sandbox

### P2 (Medium Priority)
- User authentication and progress persistence
- Chat history persistence
- Project language analysis

### P3 (Nice to Have)
- "Antigravity View" visualization
- Multi-Model Gemini Strategy
- Mobile app versions

## Technical Notes
- All AI features use Gemini via emergentintegrations
- No mocked APIs - all integrations are real
- MongoDB stores learning progress and profiles
- Frontend uses Tailwind CSS with glassmorphism design
