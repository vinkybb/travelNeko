# TravelNeko MVP Design

## Goal

TravelNeko is a playful travel-cat mini game where the player controls one cat protagonist and meets several agent cats during a journey. Each run should feel like a tiny collaborative story session: one cat sets the scene, one cat reacts socially, one cat reads hidden clues, and one cat archives the trip into a persistent memory. The MVP focuses on a full loop instead of maximal scope: player input, multi-agent orchestration, optional image understanding, optional postcard drafting, and a saved journal timeline.

## Architecture

The project uses Next.js with a single app that contains both the frontend and backend API routes. This keeps the initial implementation compact and easy to evolve. The backend exposes two routes: one for generating a new journey and one for loading archived journals. Orchestration lives in `lib/orchestrator.ts`, where the scene moves through Scout Cat, Companion Cat, Oracle Cat, Archivist Cat, and optionally Painter Cat. Model access is handled through an OpenAI-compatible client configured by environment variables so the same code can target the OpenAI API or another compatible HTTP endpoint.

## Data Flow

The frontend collects a travel setup card, optional image (file upload on the info kiosk, sent as `imageDataUrl`), and a postcard toggle. The journey request goes to `/api/journey`, which runs the agent chain and stores the result in a local JSON journal store. Each record captures the original input, agent outputs, archive story, postcard prompt or image, and display-friendly agent notes for the UI. The homepage also loads existing records so the right side can work as a persistent story wall.

## Testing

Local tests cover orchestration and persistence with a fake LLM client. A separate smoke script runs the real multi-agent flow against a live OpenAI-compatible endpoint using the provided environment variables. This splits correctness from connectivity and keeps iteration fast.

