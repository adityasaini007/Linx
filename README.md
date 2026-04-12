<div align="center">

# ✦ Linx

### AI-Powered Reply & Post Suggestion Tool for LinkedIn & X

![Chrome Web Store](https://img.shields.io/badge/Platform-Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge)

**You have the opinion. Linx helps you articulate it.**
**Powered by OpenRouter models.**

<a href="https://chromewebstore.google.com/detail/linx/eebgaadcigkokflpehmdhkifndodclei" target="_blank" rel="noopener noreferrer">Download on Chrome Web Store</a>

[Features](#features) · [Installation](#installation) · [Usage](#usage) · [Configuration](#configuration) · [Privacy](#privacy) · [Contributing](#contributing)

---

<img src="https://via.placeholder.com/800x400/0f172a/10b981?text=Linx+%E2%9C%A6+AI+Reply+Assistant" alt="Linx Banner" width="100%">

</div>

---

## Why Linx?

You know what you want to say. You just need help saying it well.

Linx is a **suggestion tool**, not an auto-reply bot. It helps you articulate your thoughts—turning your rough take into a polished reply that sounds like *you*, not a corporate chatbot.

**The difference:**
- Spam bots generate generic replies without your input
- Linx asks for *your angle* and helps you express it naturally

| Without Linx | With Linx |
|--------------|-----------|
| Have an opinion, struggle to word it | Share your take → get 4 ways to say it |
| Generic "Great post!" comments | Your actual perspective, well-articulated |
| Hours spent on content creation | Brain dump → polished post in seconds |
| Replies that scream "AI wrote this" | Casual, human-sounding suggestions |

---

## Features

### Share Your Take → Get Suggestions

When you click "AI Reply", Linx asks: **"What's your angle?"**

1. **Type your rough opinion** — even just a few words like "disagree, this ignores edge cases"
2. **Or skip** if you want quick suggestions without input
3. **Get 4 reply options** that articulate your perspective
4. **Try a different angle** if you change your mind

This keeps you in control. Linx suggests—*you* decide what to post.

### Human-Sounding Output

Linx is trained to sound like a real person, not a LinkedIn influencer bot:

| AI-Sounding (Bad) | Human-Sounding (Good) |
|-------------------|----------------------|
| "Absolutely brilliant insights!" | "yeah this is solid" |
| "The utility here is unmatched" | "honestly been thinking about this too" |
| "Best-in-class workflow" | "we tried something similar, worked well" |

Replies use casual language, contractions, lowercase where natural—like you're texting a friend.

### AI Reply Suggestions

Inject an **"AI Reply"** button on every post. Click it to get 4 unique reply suggestions:

- **Direct opinion** — Clear, confident take on the topic
- **Strategic insight** — Adds depth with experience or data
- **Punchy one-liner** — Memorable, quotable response
- **Nuanced perspective** — Balanced, thoughtful angle

Each suggestion is tailored to:
- The post's content and context
- The author's profile and industry
- Your personalized voice and expertise
- Platform norms (LinkedIn: professional, X: concise)

### AI Draft Suggestions

Turn rough ideas into polished posts with **"AI Draft"**:

1. Open the post composer
2. Dump your raw thoughts, bullet points, or messy notes
3. Click "AI Draft" to get 4 polished post suggestions
4. Pick one, edit if needed, and post

**Platform-aware formatting:**
- **LinkedIn**: Longer, professional, story-driven
- **X**: Punchy, under 280 characters, hook-driven

### Multimodal Understanding

Linx doesn't just read text—it **sees images too**:

- Extracts up to 2 images from posts
- Sends them to the AI for visual context
- Generates suggestions that reference image content

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

Linx fetches available models directly from OpenRouter using your API key.

- **Free models by default** — safer cost control
- **Optional paid models** — enable with a toggle (charged on your OpenRouter account)
- **Separate model choice** for replies and post drafts

Adjust **temperature** (0.0–1.5) to control creativity vs. consistency.

---

## Installation

### Chrome Web Store

Install Linx directly from the <a href="https://chromewebstore.google.com/detail/linx/eebgaadcigkokflpehmdhkifndodclei" target="_blank" rel="noopener noreferrer">Chrome Web Store</a>.

### From Source (Developer Mode)

1. **Clone the repository**
   ```bash
   git clone https://github.com/adityasaini007/Linx.git
   cd linx
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (top right toggle)

3. **Load the extension**
   - Click **Load unpacked**
   - Select the `linx` folder

4. **Configure API key**
   - Click the Linx icon in your toolbar
   - Enter your OpenRouter API key
   - Complete onboarding for personalized replies

### Getting API Keys

<details>
<summary><strong>OpenRouter API Key</strong></summary>

1. Go to [OpenRouter](https://openrouter.ai/)
2. Create or open your account API Keys page
3. Generate a key
4. Paste into Linx settings

Use free models by default in Linx, or enable paid models when needed.

</details>

---

## Usage

### Generating Reply Suggestions

1. **Browse LinkedIn or X** as usual
2. **Find a post** you want to reply to
3. **Click "AI Reply"** in the post's action bar
4. **Share your angle** (optional) — type your rough take, or skip for quick suggestions
5. **Review 4 reply options** (~2-3 seconds)
6. **Click "Insert"** to paste into the reply box, or **"Copy"** to clipboard
7. **Try different angle** if you want to approach it differently
8. **Edit if needed** and post!

### Generating Post Drafts

1. **Open the post composer** on LinkedIn or X
2. **Write a rough brain dump** — bullet points, messy thoughts, key ideas
3. **Click "AI Draft"** next to the Post button
4. **Review 4 polished suggestions** in the modal
5. **Insert your favorite** into the composer
6. **Refine and publish**

### Regenerating Suggestions

Not happy with the options? Click **"Regenerate"** to get 4 fresh alternatives, or **"Try different angle"** to provide a new perspective.

---

## Configuration

Click the **Linx icon** in your Chrome toolbar to access settings:

### API & Model Settings

| Setting | Description |
|---------|-------------|
| **OpenRouter API Key** | Your OpenRouter API key |
| **Reply Model** | Model used for generating replies |
| **Draft Model** | Model used for generating post drafts |
| **Show Paid Models** | Toggle to include paid models in selectors |
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
                                                 │   OpenRouter    │
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
| `openrouter.ai` | OpenRouter API |

---

## Contributing

Contributions are welcome! Here's how to help:

### Development Setup

```bash
# Clone the repo
git clone https://github.com/adityasaini007/Linx.git
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
- LinkedIn/X may have updated their DOM — please [open an issue](https://github.com/adityasaini007/Linx/issues)

</details>

<details>
<summary><strong>API errors or rate limits</strong></summary>

- Verify your API key is correct
- Check OpenRouter usage/credits dashboard
- Wait a few seconds and try again (rate limiting)
- Try a different model

</details>

<details>
<summary><strong>Suggestions don't match my style</strong></summary>

- Complete the full onboarding (both steps)
- Use the "What's your angle?" input to guide the AI
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

- **OpenRouter** for unified model access
- The open source community for inspiration
- Early users for feedback and bug reports

---

<div align="center">

**Built with care for builders, creators, and operators.**

**Linx** — Your AI writing assistant for LinkedIn & X. You think it, Linx helps you say it.

[Report Bug](https://github.com/adityasaini007/Linx/issues) · [Request Feature](https://github.com/adityasaini007/Linx/issues) · [Contact](mailto:feedback.linx@gmail.com) · [Star on GitHub](https://github.com/adityasaini007/Linx)

</div>
