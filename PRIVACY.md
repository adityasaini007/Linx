# Privacy Policy

**Linx - AI Reply & Post Assistant for LinkedIn & X**

*Last Updated: April 5, 2026*

---

## Overview

Linx is a browser extension that helps you generate AI-powered replies and posts on LinkedIn and X (Twitter). We are committed to protecting your privacy and being transparent about how data is handled.

**Key Principle**: Your data stays on your device. We do not operate servers, collect analytics, or track your activity.

---

## Data Collection

### What We Store Locally

All data is stored **exclusively on your device** using Chrome's secure storage APIs:

| Data Type | Storage Location | Purpose |
|-----------|------------------|---------|
| API Key | `chrome.storage.sync` | Authenticate with OpenRouter |
| Profile Answers | `chrome.storage.sync` | Personalize AI-generated content |
| System Prompts | `chrome.storage.local` | Customize reply/draft generation |
| Model Preferences | `chrome.storage.sync` | Remember your model and temperature settings |
| OpenRouter Model Cache | `chrome.storage.local` | Store fetched model list and free/paid labels |

### What We Do NOT Collect

- No personal information is sent to us
- No analytics or telemetry
- No browsing history
- No tracking cookies
- No server-side data storage

---

## Data Sharing with Third Parties

### AI API Provider

When you click "AI Reply" or "AI Draft", the following data is sent to OpenRouter:

**Sent to OpenRouter API:**
- The text content of the post you're replying to
- Author name/handle of the post (for context)
- Images attached to the post (if any, up to 2)
- Your personalized system prompt (based on your profile answers)
- Your "brain dump" text (for draft generation)

**Your API key** is sent directly to OpenRouter to authenticate requests. We never see or store your API key on any server.

### AI Provider Used

| Provider | Endpoint | Privacy Policy |
|----------|----------|----------------|
| OpenRouter | `openrouter.ai` | [OpenRouter Privacy & Terms](https://openrouter.ai/terms) |

**Important**: Data sent to OpenRouter is subject to OpenRouter's privacy policy and terms. We recommend reviewing them before use.

---

## Permissions Explained

Linx requests the following Chrome permissions:

| Permission | Why It's Needed |
|------------|-----------------|
| `storage` | Save your settings, API keys, and prompts locally |
| `activeTab` | Inject AI buttons only on LinkedIn/X tabs you're viewing |
| `scripting` | Insert generated replies/drafts into text fields |

### Host Permissions

| Domain | Purpose |
|--------|---------|
| `linkedin.com`, `x.com`, `twitter.com` | Inject content scripts for AI buttons |
| `licdn.com`, `pbs.twimg.com` | Fetch post images for AI context |
| `openrouter.ai` | OpenRouter API calls |

---

## Data Security

### How Your Data is Protected

1. **Local-Only Storage**: All sensitive data (API keys, profile) is stored in Chrome's encrypted storage, never transmitted to our servers
2. **Direct API Calls**: Requests go directly from your browser to AI providers—no intermediary servers
3. **No Persistence**: Post content is processed in memory and not stored after generation
4. **HTTPS Only**: All external communications use encrypted HTTPS connections

### API Key Security

- API keys are stored in `chrome.storage.sync`, which is encrypted by Chrome
- Keys are only transmitted to the respective AI provider's API endpoint
- We recommend using API keys with appropriate usage limits

---

## Your Rights & Controls

### You Can:

- **Delete all data**: Uninstall the extension to remove all stored data
- **Clear settings**: Use Chrome's extension settings to clear storage
- **Edit/delete profile**: Modify or remove your profile answers anytime via the popup
- **Revoke API keys**: Delete your API keys from the extension settings
- **Use without personalization**: The extension works with default prompts if you skip onboarding

### Data Retention

- **Local data**: Persists until you clear it or uninstall the extension
- **AI provider data**: Subject to each provider's retention policy (see their privacy policies)

---

## Children's Privacy

Linx is not intended for use by children under 13 years of age. We do not knowingly process data from children.

---

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date above. Continued use of the extension after changes constitutes acceptance of the updated policy.

---

## Open Source

Linx is open source software. You can review exactly how data is handled by inspecting the source code:

- **Repository**: [GitHub](https://github.com/adityasaini007/Linx)
- **License**: MIT

---

## Contact

If you have questions or concerns about this privacy policy:

- **GitHub Issues**: [Report an issue](https://github.com/adityasaini007/Linx/issues)
- **Email**: feedback.linx@gmail.com

---

## Summary

| Question | Answer |
|----------|--------|
| Do you collect my data? | No |
| Do you have servers? | No |
| Where is my data stored? | Only on your device |
| Who sees my posts? | Only the AI provider you choose |
| Can I delete my data? | Yes, anytime |
| Is the code auditable? | Yes, it's open source |

---

*This privacy policy is effective as of March 24, 2026.*
