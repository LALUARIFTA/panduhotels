/**
 * CMS Content Loader
 * Fetches site settings and applies them to the UI elements.
 */
async function syncCMSContent() {
  try {
    const response = await fetch("/api/cms/settings");
    const data = await response.json();
    const s = data.settings || {};

    // 1. Update Site Name / Branding
    if (s.siteName) {
      document.querySelectorAll(".brand span:last-child").forEach(el => {
        el.textContent = s.siteName;
      });
      // Update Title Tag
      if (document.title.includes("Pandu Hotel")) {
        document.title = document.title.replace("Pandu Hotel", s.siteName);
      }
    }

    // 2. Update Logo / Brand Mark
    if (s.logoUrl) {
      document.querySelectorAll(".brand-mark").forEach(el => {
        el.innerHTML = `<img src="${s.logoUrl}" style="width:100%; height:100%; object-fit:contain; border-radius:inherit;">`;
        el.style.background = "transparent";
      });
    }

    // 3. Update Hero Section (Homepage only)
    const heroTitle = document.querySelector(".hero h1");
    if (heroTitle && s.heroTitle) {
      heroTitle.textContent = s.heroTitle;
    }

    const heroCopy = document.querySelector(".hero-copy");
    if (heroCopy && s.tagline) {
      heroCopy.textContent = s.tagline;
    }

    const heroMedia = document.querySelector(".hero-media");
    if (heroMedia && s.bannerUrl) {
      heroMedia.style.backgroundImage = `linear-gradient(90deg, rgba(8, 24, 18, 0.82), rgba(8, 24, 18, 0.42) 52%, rgba(8, 24, 18, 0.16)), url("${s.bannerUrl}")`;
    }

    const eyebrow = document.querySelector(".hero .eyebrow");
    if (eyebrow && s.promoText) {
      eyebrow.textContent = s.promoText;
    }

    // 4. Update Footer / Contact Info
    const footerEmail = document.querySelector(".site-footer p:nth-of-type(1)"); // Matches specific footer structure
    if (footerEmail && s.contactEmail) {
      // Find the one that starts with "Email:"
      document.querySelectorAll(".site-footer p").forEach(p => {
        if (p.textContent.includes("Email:")) p.textContent = `Email: ${s.contactEmail}`;
        if (p.textContent.includes("WhatsApp:")) p.textContent = `WhatsApp: ${s.contactPhone}`;
        if (p.textContent.includes("Jakarta, Indonesia") && s.address) p.textContent = s.address;
      });
    }

  } catch (err) {
    console.warn("CMS content sync failed:", err);
  }
}

// Run on load
document.addEventListener("DOMContentLoaded", syncCMSContent);
