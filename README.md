<div align="center">

# ✦ Linx

### AI-Powered Reply & Post Assistant for LinkedIn & X

![Chrome Web Store](https://img.shields.io/badge/Platform-Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge)

**Generate smart, contextual replies and polished posts in seconds.**
**Powered by Google Gemini & GLM.**

[Features](#features) · [Installation](#installation) · [Usage](#usage) · [Configuration](#configuration) · [Privacy](#privacy) · [Contributing](#contributing)

---

<img src="https://via.placeholder.com/800x400/0f172a/10b981?text=Linx+%E2%9C%A6+AI+Reply+Assistant" alt="Linx Banner" width="100%">

</div>

---

## Why Linx?

Building a personal brand on LinkedIn and X requires consistent, high-quality engagement. But crafting thoughtful replies to every post is time-consuming.

**Linx solves this** by generating 4 distinct reply options tailored to your voice, expertise, and audience—directly within LinkedIn and X.

| Without Linx | With Linx |
|--------------|-----------|
| Stare at post, struggle to respond | Click "AI Reply", pick from 4 options |
| Generic "Great post!" comments | Contextual, insightful replies |
| Hours spent on content creation | Brain dump → polished post in seconds |
| One-size-fits-all tone | Personalized to your voice |

---

## Features

### AI Reply Generation

Inject an **"AI Reply"** button on every post. Click it to generate 4 unique reply options:

- **Direct opinion** — Clear, confident take on the topic
- **Strategic insight** — Adds depth with experience or data
- **Punchy one-liner** — Memorable, quotable response
- **Nuanced perspective** — Balanced, thoughtful angle

Each reply is tailored to:
- The post's content and context
- The author's profile and industry
- Your personalized voice and expertise
- Platform norms (LinkedIn: professional, X: concise)

### AI Draft Generation

Turn rough ideas into polished posts with **"AI Draft"**:

1. Open the post composer
2. Dump your raw thoughts, bullet points, or messy notes
3. Click "AI Draft" to generate 4 polished post options
4. Pick one, edit if needed, and post

**Platform-aware formatting:**
- **LinkedIn**: Longer, professional, story-driven
- **X**: Punchy, under 280 characters, hook-driven

### Multimodal Understanding

Linx doesn't just read text—it **sees images too**:

- Extracts up to 2 images from posts
- Sends them to the AI for visual context
- Generates replies that reference image content

### Deep Personalization

Complete a quick onboarding to teach Linx your:

| Profile Field | Example |
|---------------|---------|
| Name/Brand | "Jane Doe" or "Acme AI" |
| Role | "Founder building AI products" |
| Expertise | "AI agents, growth, developer tools" |
| Audience | "Builders, operators, founders" |
| Tone | "Direct, practical, opinionated" |
| Goals | "Build authority, share insights" |
| Avoid | "No cringe hype, no platitudes" |
| Topics | "AI agents, robotics, product building" |
| POV | "Builder-first, contrarian" |
| Signature phrases | Custom expressions you use |

Linx auto-generates tailored system prompts for each platform and mode. You can also edit prompts directly for full control.

### Model Selection

Choose your preferred AI model for replies and drafts:

| Provider | Models Available |
|----------|------------------|
| **Google Gemini** | Gemini 3 Flash, Gemini 3.1 Flash Lite, Gemini 3.1 Pro |
| **GLM (Zhipu AI)** | GLM-4.7, GLM-4.7 Flash |

Adjust **temperature** (0.0–1.5) to control creativity vs. consistency.

---

## Installation

### From Source (Developer Mode)

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/linx.git
   cd linx
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (top right toggle)

3. **Load the extension**
   - Click **Load unpacked**
   - Select the `linx` folder

4. **Configure API keys**
   - Click the Linx icon in your toolbar
   - Enter your Gemini and/or GLM API key
   - Complete onboarding for personalized replies

### Getting API Keys

<details>
<summary><strong>Google Gemini API Key</strong></summary>

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key (starts with `AIza...`)
4. Paste into Linx settings

**Free tier**: 60 requests/minute, sufficient for personal use.

</details>

<details>
<summary><strong>GLM API Key</strong></summary>

1. Go to [Zhipu AI Platform](https://open.bigmodel.cn/)
2. Sign up and navigate to API Keys
3. Create a new key
4. Paste into Linx settings

</details>

---

## Usage

### Generating Replies

1. **Browse LinkedIn or X** as usual
2. **Find a post** you want to reply to
3. **Click "✦ AI Reply"** in the post's action bar
4. **Wait ~2-3 seconds** for 4 reply options
5. **Click "Insert"** to paste into the reply box, or **"Copy"** to clipboard
6. **Edit if needed** and post!

### Generating Post Drafts

1. **Open the post composer** on LinkedIn or X
2. **Write a rough brain dump** — bullet points, messy thoughts, key ideas
3. **Click "✦ AI Draft"** next to the Post button
4. **Review 4 polished drafts** in the modal
5. **Insert your favorite** into the composer
6. **Refine and publish**

### Regenerating Content

Not happy with the options? Click **"Regenerate"** to get 4 fresh alternatives.

---

## Configuration

Click the **Linx icon** in your Chrome toolbar to access settings:

### API & Model Settings

| Setting | Description |
|---------|-------------|
| **Gemini API Key** | Your Google AI Studio API key |
| **GLM API Key** | Your Zhipu AI API key |
| **Reply Model** | Model used for generating replies |
| **Draft Model** | Model used for generating post drafts |
| **Temperature** | Creativity level (0.0 = focused, 1.5 = creative) |

### System Prompts

Linx generates 4 system prompts based on your profile:

- **Reply Prompt (LinkedIn)** — For LinkedIn replies
- **Reply Prompt (X)** — For X/Twitter replies
- **Draft Prompt (LinkedIn)** — For LinkedIn posts
- **Draft Prompt (X)** — For X/Twitter posts

You can:
- **Edit prompts directly** for fine-grained control
- **Regenerate individual prompts** after updating your profile
- **Regenerate all prompts** with one click

---

## Architecture

```
linx/
├── manifest.json      # Chrome extension manifest (MV3)
├── background.js      # Service worker — AI API calls, prompt building
├── content.js         # Content script — button injection, modal UI
├── content.css        # Styles for injected buttons
├── popup.html         # Extension popup — settings & onboarding
├── popup.js           # Popup logic — settings management
├── popup.css          # Popup styling
├── icons/             # Extension icons (16, 48, 128px)
├── PRIVACY.md         # Privacy policy
├── LICENSE            # MIT License
└── README.md          # This file
```

### Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   LinkedIn/X    │────▶│   content.js     │────▶│  background.js  │
│   (Post Data)   │     │ (Extract & UI)   │     │  (API Calls)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  Gemini / GLM   │
                                                 │   (AI Models)   │
                                                 └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Reply Box     │◀────│   content.js     │◀────│    Replies      │
│   (Inserted)    │     │  (Render Modal)  │     │   (4 options)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Privacy

**Your data stays on your device.** Linx does not operate servers or collect analytics.

| Concern | Answer |
|---------|--------|
| Where is data stored? | Locally in Chrome storage |
| What's sent to AI? | Post content + your system prompt |
| Do you see my API keys? | No, they're sent directly to providers |
| Any tracking? | None whatsoever |

Read the full [Privacy Policy](PRIVACY.md).

---

## Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Save settings and prompts locally |
| `activeTab` | Inject buttons on LinkedIn/X only |
| `scripting` | Insert replies into text fields |

### Host Permissions

| Domain | Reason |
|--------|--------|
| `linkedin.com`, `x.com` | Content script injection |
| `licdn.com`, `pbs.twimg.com` | Fetch post images |
| `generativelanguage.googleapis.com` | Gemini API |
| `open.bigmodel.cn`, `api.z.ai` | GLM API |

---

## Contributing

Contributions are welcome! Here's how to help:

### Development Setup

```bash
# Clone the repo
git clone https://github.com/your-username/linx.git
cd linx

# Load in Chrome (Developer Mode)
# Make changes and reload the extension to test
```

### Guidelines

- **No frameworks** — Keep it vanilla JS for simplicity
- **Privacy first** — Never add tracking or external analytics
- **Minimal permissions** — Don't request more than needed
- **Test on both platforms** — LinkedIn and X have different DOMs

### Ideas for Contributions

- [ ] Support for additional platforms (Threads, Bluesky)
- [ ] More AI providers (Claude, OpenAI)
- [ ] Keyboard shortcuts
- [ ] Reply history/favorites
- [ ] Export/import settings
- [ ] Dark/light theme toggle

---

## Troubleshooting

<details>
<summary><strong>AI Reply button doesn't appear</strong></summary>

- Refresh the page
- Check that the extension is enabled in `chrome://extensions/`
- LinkedIn/X may have updated their DOM — please [open an issue](https://github.com/your-username/linx/issues)

</details>

<details>
<summary><strong>API errors or rate limits</strong></summary>

- Verify your API key is correct
- Check your API provider's usage dashboard
- Wait a few seconds and try again (rate limiting)
- Try a different model

</details>

<details>
<summary><strong>Replies don't match my style</strong></summary>

- Complete the full onboarding (both steps)
- Edit your system prompts directly for fine-tuning
- Adjust temperature (lower = more consistent, higher = more creative)

</details>

<details>
<summary><strong>Insert doesn't work</strong></summary>

- Make sure the reply/compose box is open and focused
- Try clicking inside the text field first
- Use "Copy" as a fallback and paste manually

</details>

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- **Google Gemini** and **Zhipu AI** for AI APIs
- The open source community for inspiration
- Early users for feedback and bug reports

---

<div align="center">

**Built with care for builders, creators, and operators.**

✦ **Linx** — Your AI voice on LinkedIn & X

[Report Bug](https://github.com/your-username/linx/issues) · [Request Feature](https://github.com/your-username/linx/issues) · [Star on GitHub](https://github.com/your-username/linx)

</div>
