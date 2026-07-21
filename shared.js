// Shared interactions: scroll reveal + smooth nav highlight
document.addEventListener("DOMContentLoaded", () => {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // FAQ accordion
  document.querySelectorAll(".qa__q").forEach((q) => {
    q.addEventListener("click", () => {
      const qa = q.closest(".qa");
      qa.classList.toggle("is-open");
    });
  });

  document.querySelectorAll("video[autoplay]").forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;

    const playVideo = () => {
      const promise = video.play();
      if (promise && typeof promise.catch === "function") promise.catch(() => {});
    };

    if (video.readyState >= 2) playVideo();
    video.addEventListener("loadedmetadata", playVideo, { once: true });
    video.addEventListener("canplay", playVideo, { once: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && video.paused) playVideo();
    });
  });
});
