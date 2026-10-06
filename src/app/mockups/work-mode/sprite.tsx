/** Icon sprite from the Work Mode design. Synthetic UI only. */
export function IconSprite() {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: SPRITE }}
    />
  );
}

const SPRITE = `<svg width="0" height="0" aria-hidden="true">
  <symbol id="menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
  <symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/></symbol>
  <symbol id="chev" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></symbol>
  <symbol id="chevr" viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"/></symbol>
  <symbol id="chevl" viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></symbol>
  <symbol id="plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
  <symbol id="minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
  <symbol id="check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></symbol>
  <symbol id="x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
  <symbol id="up" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></symbol>
  <symbol id="arrowr" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
  <symbol id="mic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></symbol>
  <symbol id="clip" viewBox="0 0 24 24"><path d="m20.5 11.5-8.3 8.3a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/></symbol>
  <symbol id="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></symbol>
  <symbol id="phone" viewBox="0 0 24 24"><path d="M21 16.4v2.9a1.9 1.9 0 0 1-2.1 1.9A18.8 18.8 0 0 1 2.8 5.1 1.9 1.9 0 0 1 4.7 3h2.9a1.9 1.9 0 0 1 1.9 1.6c.1.9.4 1.8.7 2.7a1.9 1.9 0 0 1-.4 2L8.5 10.6a15 15 0 0 0 4.9 4.9l1.3-1.3a1.9 1.9 0 0 1 2-.4c.9.3 1.8.6 2.7.7a1.9 1.9 0 0 1 1.6 1.9z"/></symbol>
  <symbol id="clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></symbol>
  <symbol id="cal" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></symbol>
  <symbol id="board" viewBox="0 0 24 24"><path d="M3 4h18M4.5 4v9.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V4M12 15v3.5M8 21l4-2.5 4 2.5"/></symbol>
  <symbol id="award" viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M8.6 13.9 7.5 21l4.5-2.5 4.5 2.5-1.1-7.1"/></symbol>
  <symbol id="case" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/></symbol>
  <symbol id="star" viewBox="0 0 24 24"><path d="M12 3c.6 4.6 2.4 6.4 9 9-6.6 2.6-8.4 4.4-9 9-.6-4.6-2.4-6.4-9-9 6.6-2.6 8.4-4.4 9-9z"/></symbol>
  <symbol id="users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6"/></symbol>
  <symbol id="swap" viewBox="0 0 24 24"><path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/></symbol>
  <symbol id="doc" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></symbol>
  <symbol id="alert" viewBox="0 0 24 24"><path d="M10.3 4.3 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/></symbol>
  <symbol id="pager" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 10.5h10M7 13.5h6"/></symbol>
  <symbol id="send" viewBox="0 0 24 24"><path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5-7.5-4z"/></symbol>
  <symbol id="pen" viewBox="0 0 24 24"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z"/></symbol>
  <symbol id="cup" viewBox="0 0 24 24"><path d="M5 9h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M11.5 3.5v2.5"/></symbol>
  <symbol id="power" viewBox="0 0 24 24"><path d="M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0"/></symbol>
  <symbol id="receipt" viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/></symbol>
  <symbol id="folder" viewBox="0 0 24 24"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.7l2 2h7.3A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></symbol>
  <symbol id="shield" viewBox="0 0 24 24"><path d="M12 3 5 6v5.2c0 4.4 3 8.2 7 9.8 4-1.6 7-5.4 7-9.8V6z"/><path d="m9 12 2 2 4-4"/></symbol>
  <symbol id="book" viewBox="0 0 24 24"><path d="M12 7a4 4 0 0 0-4-3H3v14h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5V4h-5a4 4 0 0 0-4 3zM12 7v14"/></symbol>
  <symbol id="upload" viewBox="0 0 24 24"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></symbol>
  <symbol id="history" viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2"/></symbol>
  <symbol id="pin" viewBox="0 0 24 24"><path d="M12 16.5V21M8.5 3h7l-1 5.5 3 3.5h-11l3-3.5z"/></symbol>
  <symbol id="grid" viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></symbol>
  <symbol id="moon" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/></symbol>
  <symbol id="pill" viewBox="0 0 24 24"><rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)"/><path d="m9.6 9.6 4.8 4.8"/></symbol>
  <symbol id="pulse" viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></symbol>
  <symbol id="bell" viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></symbol>
  <symbol id="ext" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/></symbol>
  <symbol id="qrc" viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h.01M20 14h.01"/></symbol>
  <symbol id="share" viewBox="0 0 24 24"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M6 11H5a1 1 0 0 0-1 1v7.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V12a1 1 0 0 0-1-1h-1"/></symbol>
  <symbol id="layers" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/></symbol>
  <symbol id="sliders" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></symbol>
  <symbol id="leave" viewBox="0 0 24 24"><path d="M12 21v-7M12 14c-4.5 0-7.5-3.5-7.5-8 3.5 0 6 1.5 7.5 4 1.5-2.5 4-4 7.5-4 0 4.5-3 8-7.5 8z"/></symbol>
  <symbol id="star5" viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></symbol>

  <symbol id="wm-sun" viewBox="0 0 120 120"><circle cx="60" cy="60" r="20"/><path d="M60 14v18M60 88v18M14 60h18M88 60h18M27.5 27.5l12.7 12.7M79.8 79.8l12.7 12.7M27.5 92.5l12.7-12.7M79.8 40.2l12.7-12.7"/></symbol>
  <symbol id="wm-phone" viewBox="0 0 120 120"><path d="M30 16h20l10 26-13 8a56 56 0 0 0 25 25l8-13 26 10v20a10 10 0 0 1-10 10C51 102 18 69 18 26a10 10 0 0 1 12-10zM74 18a30 30 0 0 1 28 28M74 32a16 16 0 0 1 14 14"/></symbol>
  <symbol id="wm-clock" viewBox="0 0 120 120"><circle cx="60" cy="60" r="44"/><circle cx="60" cy="60" r="3"/><path d="M60 32v28l18 11M60 20v6M60 94v6M20 60h6M94 60h6"/></symbol>
  <symbol id="wm-cal" viewBox="0 0 120 120"><rect x="16" y="24" width="88" height="80" rx="10"/><path d="M16 48h88M40 14v20M80 14v20M34 66h12M54 66h12M74 66h12M34 84h12M54 84h12"/></symbol>
  <symbol id="wm-board" viewBox="0 0 120 120"><path d="M12 18h96M20 18v50a6 6 0 0 0 6 6h68a6 6 0 0 0 6-6V18M60 74v16M40 104l20-14 20 14M36 52l14-12 12 10 22-18"/></symbol>
  <symbol id="wm-award" viewBox="0 0 120 120"><circle cx="60" cy="46" r="30"/><circle cx="60" cy="46" r="17"/><path d="M42 70l-8 38 26-14 26 14-8-38"/></symbol>
  <symbol id="wm-case" viewBox="0 0 120 120"><rect x="14" y="36" width="92" height="66" rx="10"/><path d="M44 36V26a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v10M14 64h92M54 60h12v10H54z"/></symbol>
  <symbol id="wm-star" viewBox="0 0 120 120"><path d="M60 12c3 24 12 33 48 48-36 15-45 24-48 48-3-24-12-33-48-48 36-15 45-24 48-48z"/></symbol>
</svg>`;
