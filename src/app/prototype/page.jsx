'use client'
import { useState } from "react";

const COLORS = {
  cream: "#FAF7F2", sand: "#E8DDD0", terracotta: "#C4673A", terracottaLight: "#E8825A",
  darkBrown: "#2C1A0E", mediumBrown: "#6B4226", lightText: "#9C7B65", white: "#FFFFFF", green: "#4A7C59",
};

const products = [
  { id: 1, name: "Maxi kjole – midnattsblå", owner: "Marte Nilsen", via: null, size: "S/36", category: "kjole", available: true, image: "https://picsum.photos/seed/dress1/400/500", description: "Lang blå kjole fra Bruuns Bazaar. Brukt én gang til bryllup.", reach: { venner: "gratis", vennerAvVenner: "200 kr", offentlig: null }, babyAge: null, babyUse: null },
  { id: 2, name: "BabyBjörn Vippestol Bliss", owner: "Sofie Berg", via: null, size: "0–2 år", category: "baby", available: true, image: "https://picsum.photos/seed/baby2/400/500", description: "Vippestol i grå woven melange. Brukt av ett barn, veldig god stand.", reach: { venner: "gratis", vennerAvVenner: "gratis", offentlig: "150 kr" }, babyAge: "0–6 mnd", babyUse: "sove" },
  { id: 3, name: "Grønn ballkjole", owner: "Ida Haugen", via: "Marte Nilsen", size: "M/38", category: "kjole", available: true, image: "https://picsum.photos/seed/dress3/400/500", description: "Flott grønn kjole, perfekt til bryllup eller galla. Fra & Other Stories.", reach: { venner: "gratis", vennerAvVenner: "100 kr", offentlig: null }, babyAge: null, babyUse: null },
  { id: 4, name: "Babyklær pakke 3–6 mnd", owner: "Linn Holm", via: "Sofie Berg", size: "3–6 mnd", category: "baby", available: false, image: "https://picsum.photos/seed/baby4/400/500", description: "Komplett pakke med bodyer og sparkebukser. Merker som Joha og Liewood.", reach: { venner: "gratis", vennerAvVenner: "gratis", offentlig: "100 kr" }, babyAge: "3–6 mnd", babyUse: "klær" },
  { id: 5, name: "Stokke Tripp Trapp", owner: "Marte Nilsen", via: null, size: "6 mnd+", category: "baby", available: true, image: "https://picsum.photos/seed/baby6/400/500", description: "Klassisk Stokke høystol i hvit. Inkl. babysete og pute. Justerbar til voksen.", reach: { venner: "gratis", vennerAvVenner: "200 kr", offentlig: "400 kr" }, babyAge: "6–12 mnd", babyUse: "spise" },
  { id: 6, name: "Bosch drill/skrutrekker", owner: "Erik Dahl", via: null, size: "18V", category: "verktøy", available: true, image: "https://picsum.photos/seed/tool7/400/500", description: "Bosch GSR 18V-55 med to batterier og lader. Perfekt til flatpakkemøbler.", reach: { venner: "gratis", vennerAvVenner: "100 kr", offentlig: "200 kr" }, babyAge: null, babyUse: null },
  { id: 7, name: "Stikksag – Makita", owner: "Sofie Berg", via: null, size: "Universal", category: "verktøy", available: true, image: "https://picsum.photos/seed/tool9/400/500", description: "Makita stikksag med flere sagblader. Fin til tre og laminat.", reach: { venner: "gratis", vennerAvVenner: "gratis", offentlig: null }, babyAge: null, babyUse: null },
];

// Bookshelves – one per person
const bookshelves = [
  {
    id: 1, owner: "Marte Nilsen", via: null, avatar: "M",
    totalBooks: 34, availableBooks: 28,
    genres: ["Skjønnlitteratur", "Biografi"],
    preview: [
      { title: "Solstad – Armand V.", cover: "https://picsum.photos/seed/book1/80/120", available: true },
      { title: "Knausgård – Min kamp 1", cover: "https://picsum.photos/seed/book2/80/120", available: true },
      { title: "Ferrante – Venninnen", cover: "https://picsum.photos/seed/book3/80/120", available: false },
      { title: "Tore Renberg – Kompani Orheim", cover: "https://picsum.photos/seed/book4/80/120", available: true },
    ]
  },
  {
    id: 2, owner: "Sofie Berg", via: null, avatar: "S",
    totalBooks: 52, availableBooks: 44,
    genres: ["Thriller", "Sci-fi", "Skjønnlitteratur"],
    preview: [
      { title: "Jo Nesbø – Snømannen", cover: "https://picsum.photos/seed/book5/80/120", available: true },
      { title: "Stieg Larsson – Menn som hater kvinner", cover: "https://picsum.photos/seed/book6/80/120", available: true },
      { title: "Cixin Liu – Den mørke skog", cover: "https://picsum.photos/seed/book7/80/120", available: true },
      { title: "Toni Morrison – Elsket", cover: "https://picsum.photos/seed/book8/80/120", available: false },
    ]
  },
  {
    id: 3, owner: "Ida Haugen", via: "Marte Nilsen", avatar: "I",
    totalBooks: 19, availableBooks: 19,
    genres: ["Selvhjelp", "Biografi"],
    preview: [
      { title: "Matthew Walker – Hvorfor vi sover", cover: "https://picsum.photos/seed/book9/80/120", available: true },
      { title: "Viktor Frankl – Ja til livet", cover: "https://picsum.photos/seed/book10/80/120", available: true },
      { title: "Michelle Obama – Becoming", cover: "https://picsum.photos/seed/book11/80/120", available: true },
      { title: "Brené Brown – Mot til å være sårbar", cover: "https://picsum.photos/seed/book12/80/120", available: true },
    ]
  },
];

// AI-detected books from shelf scan
const scannedBooks = [
  { id: 1, title: "Solstad – Armand V.", author: "Dag Solstad", cover: "https://picsum.photos/seed/scan1/80/120", year: 2006, selected: true },
  { id: 2, title: "Min kamp 1", author: "Karl Ove Knausgård", cover: "https://picsum.photos/seed/scan2/80/120", year: 2009, selected: true },
  { id: 3, title: "Venninnen", author: "Elena Ferrante", cover: "https://picsum.photos/seed/scan3/80/120", year: 2011, selected: false },
  { id: 4, title: "Snømannen", author: "Jo Nesbø", cover: "https://picsum.photos/seed/scan4/80/120", year: 2007, selected: true },
  { id: 5, title: "Sapiens", author: "Yuval Noah Harari", cover: "https://picsum.photos/seed/scan5/80/120", year: 2011, selected: true },
  { id: 6, title: "Atomvaner", author: "James Clear", cover: "https://picsum.photos/seed/scan6/80/120", year: 2018, selected: true },
  { id: 7, title: "Den mørke skog", author: "Liu Cixin", cover: "https://picsum.photos/seed/scan7/80/120", year: 2008, selected: false },
  { id: 8, title: "Kompani Orheim", author: "Tore Renberg", cover: "https://picsum.photos/seed/scan8/80/120", year: 2012, selected: true },
];

const wishes = [
  { id: 1, from: "Marte Nilsen", via: null, text: "Trenger en lang kjole til bryllup 14. juni, helst str 36–38 🙏", category: "kjole", time: "2 timer siden", avatar: "M" },
  { id: 2, from: "Jonas Vik", via: "Sofie Berg", text: "Noen som har en høytrykkspyler jeg kan låne i helgen?", category: "verktøy", time: "5 timer siden", avatar: "J" },
  { id: 3, from: "Ida Haugen", via: null, text: "Leter etter vippestol til nyfødt 👶", category: "baby", time: "i går", avatar: "I" },
  { id: 4, from: "Emma Dahl", via: "Marte Nilsen", text: "Noen som har «Sapiens» eller noe av Harari?", category: "bok", time: "i går", avatar: "E" },
];

const urlFetchResults = {
  default: { name: "BabyBjörn Vippestol Bouncer Bliss", image: "https://picsum.photos/seed/babybjorn/400/300", description: "Ergonomisk vippestol som stimulerer babyens naturlige bevegelser. Passer fra nyfødt til 2 år.", source: "babyshop.no" },
  stokke: { name: "Stokke Tripp Trapp høystol", image: "https://picsum.photos/seed/stokke/400/300", description: "Ergonomisk høystol som vokser med barnet.", source: "stokke.com" },
  kjole: { name: "Gestuz – AlmaGZ kjole, midnattsblå", image: "https://picsum.photos/seed/gzdress/400/300", description: "Lang midi-kjole i recycled polyester. Elegant silhuett med V-hals.", source: "gestuz.com" },
  bosch: { name: "Bosch GSR 18V-55 Professional drill", image: "https://picsum.photos/seed/boschdrill/400/300", description: "Kompakt og kraftig drill/skrutrekker med 2 batterier og hurtiglader inkludert.", source: "clas-ohlson.no" },
};

const BABY_AGES = ["alle aldre", "0–6 mnd", "3–6 mnd", "6–12 mnd", "1–2 år", "2+ år"];
const BABY_USES = ["alle", "sove", "spise", "leke", "stelle", "klær"];
const categoryEmoji = { kjole: "👗", baby: "🍼", verktøy: "🔧", bok: "📚" };

const Badge = ({ children, color }) => (
  <span style={{ background: color || COLORS.sand, color: COLORS.mediumBrown, fontSize: 11, fontFamily: "'DM Sans',sans-serif", padding: "3px 9px", borderRadius: 999, fontWeight: 500 }}>{children}</span>
);
const Pill = ({ label, active, onClick, small }) => (
  <button onClick={onClick} style={{ padding: small ? "5px 12px" : "8px 18px", borderRadius: 999, border: active ? "none" : `1.5px solid ${COLORS.sand}`, background: active ? COLORS.terracotta : COLORS.white, color: active ? COLORS.white : COLORS.mediumBrown, fontFamily: "'DM Sans',sans-serif", fontSize: small ? 12 : 13, fontWeight: active ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
);

// All books across all shelves (flattened, with owner info)
const allBooks = bookshelves.flatMap(shelf =>
  shelf.preview.map(book => ({ ...book, owner: shelf.owner, avatar: shelf.avatar, via: shelf.via, shelfId: shelf.id }))
).concat([
  { title: "Sapiens", cover: "https://picsum.photos/seed/bk13/80/120", available: true, owner: "Marte Nilsen", avatar: "M", via: null, shelfId: 1, genre: "Biografi", lang: "Norsk" },
  { title: "Atomvaner", cover: "https://picsum.photos/seed/bk14/80/120", available: true, owner: "Sofie Berg", avatar: "S", via: null, shelfId: 2, genre: "Selvhjelp", lang: "Norsk" },
  { title: "Thinking Fast and Slow", cover: "https://picsum.photos/seed/bk15/80/120", available: true, owner: "Sofie Berg", avatar: "S", via: null, shelfId: 2, genre: "Selvhjelp", lang: "Engelsk" },
  { title: "Normal People", cover: "https://picsum.photos/seed/bk16/80/120", available: false, owner: "Ida Haugen", avatar: "I", via: "Marte Nilsen", shelfId: 3, genre: "Skjønnlitteratur", lang: "Engelsk" },
  { title: "Station Eleven", cover: "https://picsum.photos/seed/bk17/80/120", available: true, owner: "Marte Nilsen", avatar: "M", via: null, shelfId: 1, genre: "Sci-fi", lang: "Engelsk" },
  { title: "Beloved", cover: "https://picsum.photos/seed/bk18/80/120", available: true, owner: "Ida Haugen", avatar: "I", via: "Marte Nilsen", shelfId: 3, genre: "Skjønnlitteratur", lang: "Engelsk" },
]);

// Add genre/lang to preview books too
const allBooksTagged = allBooks.map((b, i) => ({
  ...b,
  genre: b.genre || ["Skjønnlitteratur","Thriller","Skjønnlitteratur","Thriller","Skjønnlitteratur","Biografi","Thriller","Skjønnlitteratur","Selvhjelp","Biografi","Selvhjelp","Skjønnlitteratur"][i % 12],
  lang: b.lang || (i % 3 === 0 ? "Norsk" : "Engelsk"),
}));

function BookshelfSection({ onShelf, genreFilter = "alle", langFilter = "alle", activeFilter = "alle" }) {
  const [bookSearch, setBookSearch] = useState("");
  const [allCollapsed, setAllCollapsed] = useState(false);

  const isBookView = activeFilter === "bok";

  const applyFilters = (books) => books.filter(b => {
    if (genreFilter !== "alle" && b.genre !== genreFilter) return false;
    if (langFilter !== "alle" && b.lang !== langFilter) return false;
    return true;
  });

  const baseResults = bookSearch.trim().length > 1
    ? allBooksTagged.filter(b => b.title.toLowerCase().includes(bookSearch.toLowerCase()))
    : null;

  const searchResults = baseResults ? applyFilters(baseResults) : null;

  // When genre/lang filter is active without search, show flat grid of matching books
  const filterActive = genreFilter !== "alle" || langFilter !== "alle";
  const filteredAllBooks = isBookView && filterActive && !searchResults
    ? applyFilters(allBooksTagged)
    : null;

  return (
    <div style={{ padding: "18px 14px 0" }}>
      {/* Header with single collapse toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: "'Lora',serif", fontSize: 16, fontWeight: 700, color: COLORS.darkBrown }}>📚 Bokhyller</div>
        <button onClick={() => setAllCollapsed(c => !c)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.lightText }}>{bookshelves.length} venner</span>
          <span style={{ fontSize: 13, color: COLORS.lightText, display: "inline-block", transform: allCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
        </button>
      </div>

      {!allCollapsed && (
        <>
          {/* Cross-shelf search */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
            <input
              value={bookSearch}
              onChange={e => setBookSearch(e.target.value)}
              placeholder="Søk blant alle bøker i kretsen…"
              style={{ width: "100%", background: COLORS.white, border: `1.5px solid ${bookSearch ? COLORS.terracotta : COLORS.sand}`, borderRadius: 12, padding: "10px 14px 10px 36px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.darkBrown, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
            />
            {bookSearch && (
              <button onClick={() => setBookSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: COLORS.lightText, fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            )}
          </div>

          {/* Flat book grid: search results OR genre/lang filter results */}
          {(searchResults || filteredAllBooks) ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: COLORS.lightText, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>
                {(searchResults || filteredAllBooks).length} bøker
              </div>
              {(searchResults || filteredAllBooks).length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.lightText }}>Ingen bøker funnet 📭</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {(searchResults || filteredAllBooks).map((book, i) => (
                    <div key={i} style={{ cursor: "pointer" }}>
                      <div style={{ position: "relative", marginBottom: 5 }}>
                        <img src={book.cover} alt={book.title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 6, display: "block", opacity: book.available ? 1 : 0.45 }} />
                        {!book.available && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "rgba(44,26,14,0.15)" }}><span style={{ fontSize: 16 }}>🔒</span></div>}
                        {book.available && <div style={{ position: "absolute", bottom: 4, right: 4, width: 10, height: 10, borderRadius: "50%", background: COLORS.green, border: `2px solid ${COLORS.white}` }} />}
                        {/* friend color dot */}
                        <div style={{ position: "absolute", top: 4, left: 4, width: 8, height: 8, borderRadius: "50%", background: book.via ? "#C4873A" : COLORS.green, border: `1.5px solid ${COLORS.white}` }} />
                      </div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: COLORS.lightText, lineHeight: 1.2 }}>{book.owner.split(" ")[0]}</div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: COLORS.darkBrown, fontWeight: 600, lineHeight: 1.3 }}>{book.title}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Individual shelves */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {bookshelves.map(shelf => (
                <div key={shelf.id} onClick={() => onShelf(shelf)} style={{ background: COLORS.white, borderRadius: 16, padding: "14px", boxShadow: "0 2px 8px rgba(44,26,14,0.06)", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.terracotta, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.white, fontFamily: "'Lora',serif", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{shelf.avatar}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: COLORS.darkBrown }}>{shelf.owner.split(" ")[0]}s bokhylle</div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: COLORS.lightText }}>
                        {shelf.availableBooks} av {shelf.totalBooks} tilgjengelig
                        {shelf.via && <span> · via {shelf.via.split(" ")[0]}</span>}
                      </div>
                    </div>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.terracotta, fontWeight: 600 }}>Se alle →</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {shelf.preview.map((book, i) => (
                      <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                        <img src={book.cover} alt={book.title} style={{ width: 52, height: 76, objectFit: "cover", borderRadius: 4, display: "block", opacity: book.available ? 1 : 0.45 }} />
                        {!book.available && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }}><span style={{ fontSize: 16 }}>🔒</span></div>}
                      </div>
                    ))}
                    {shelf.totalBooks > 4 && (
                      <div style={{ width: 52, height: 76, borderRadius: 4, background: COLORS.sand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: COLORS.mediumBrown, fontWeight: 700 }}>+{shelf.totalBooks - 4}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {shelf.genres.map(g => <Badge key={g} color="#FFF0E8">{g}</Badge>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- FEED ----
function FeedScreen({ onProduct, onAsk, onShelf }) {
  const [filter, setFilter] = useState("alle");
  const [babyAge, setBabyAge] = useState("alle aldre");
  const [babyUse, setBabyUse] = useState("alle");
  const [bookGenre, setBookGenre] = useState("alle");
  const [bookLang, setBookLang] = useState("alle");

  const filtered = products.filter(p => {
    if (filter !== "alle" && p.category !== filter) return false;
    if (filter === "baby") {
      if (babyAge !== "alle aldre" && p.babyAge !== babyAge) return false;
      if (babyUse !== "alle" && p.babyUse !== babyUse) return false;
    }
    return true;
  });

  const showBooks = filter === "alle" || filter === "bok";

  return (
    <div style={{ background: COLORS.cream, minHeight: "100%", paddingBottom: 80 }}>
      <div style={{ padding: "28px 20px 16px", background: COLORS.cream, borderBottom: `1px solid ${COLORS.sand}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Lora',serif", fontSize: 22, fontWeight: 700, color: COLORS.darkBrown }}>Village</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.lightText, marginTop: 1 }}>Lån og lån bort i kretsen din</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: COLORS.terracotta, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.white, fontFamily: "'Lora',serif", fontWeight: 700, fontSize: 15 }}>K</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, overflowX: "auto", paddingBottom: 2 }}>
          {["alle", "baby", "bok", "kjole", "verktøy"].map(c => (
            <Pill key={c} label={c === "alle" ? "Alle" : c === "baby" ? "🍼 Baby" : c === "bok" ? "📚 Bøker" : c === "kjole" ? "👗 Kjoler" : "🔧 Verktøy"} active={filter === c} onClick={() => setFilter(c)} />
          ))}
        </div>
        {filter === "baby" && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.sand}`, paddingTop: 12 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: COLORS.lightText, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>Alder</div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
              {BABY_AGES.map(a => <Pill key={a} label={a} active={babyAge === a} onClick={() => setBabyAge(a)} small />)}
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: COLORS.lightText, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>Bruksområde</div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {BABY_USES.map(u => <Pill key={u} label={u === "alle" ? "Alle" : u.charAt(0).toUpperCase() + u.slice(1)} active={babyUse === u} onClick={() => setBabyUse(u)} small />)}
            </div>
          </div>
        )}
        {filter === "bok" && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.sand}`, paddingTop: 12 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: COLORS.lightText, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>Sjanger</div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
              {["alle", "Skjønnlitteratur", "Thriller", "Biografi", "Sci-fi", "Selvhjelp", "Barn"].map(g => (
                <Pill key={g} label={g === "alle" ? "Alle" : g} active={bookGenre === g} onClick={() => setBookGenre(g)} small />
              ))}
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: COLORS.lightText, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>Språk</div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {["alle", "Norsk", "Engelsk", "Annet"].map(l => (
                <Pill key={l} label={l === "alle" ? "Alle" : l} active={bookLang === l} onClick={() => setBookLang(l)} small />
              ))}
            </div>
          </div>
        )}
      </div>


      {/* Spør kretsen banner */}
      <div onClick={onAsk} style={{ margin: "14px 14px 0", background: COLORS.darkBrown, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <span style={{ fontSize: 24 }}>🙋</span>
        <div>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 13, fontWeight: 700, color: COLORS.white }}>Spør kretsen</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>Finner du ikke det du leter etter? Spør!</div>
        </div>
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.5)", fontSize: 18 }}>→</span>
      </div>

      {/* Bokhyller */}
      {showBooks && <BookshelfSection onShelf={onShelf} genreFilter={bookGenre} langFilter={bookLang} activeFilter={filter} />}

      {/* Products grid */}
      {filter !== "bok" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "14px 14px" }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => onProduct(p)} style={{ background: COLORS.white, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(44,26,14,0.07)", cursor: "pointer" }}>
              <div style={{ position: "relative" }}>
                <img src={p.image} alt={p.name} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                {!p.available && <div style={{ position: "absolute", inset: 0, background: "rgba(44,26,14,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: COLORS.white, fontFamily: "'Lora',serif", fontSize: 13, fontWeight: 600, letterSpacing: "0.06em" }}>UTLÅNT</span></div>}
                <div style={{ position: "absolute", top: 7, right: 7, background: "rgba(44,26,14,0.55)", borderRadius: 999, padding: "3px 9px", fontSize: 10, fontFamily: "'DM Sans',sans-serif", color: COLORS.white, fontWeight: 600 }}>
                  {p.reach.venner === "gratis" ? "Gratis" : p.reach.venner}
                </div>
              </div>
              <div style={{ padding: "10px 12px 12px" }}>
                <div style={{ fontFamily: "'Lora',serif", fontSize: 13, fontWeight: 600, color: COLORS.darkBrown, lineHeight: 1.3, marginBottom: 5 }}>{p.name}</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <Badge>{p.size}</Badge>
                  <span style={{ fontSize: 11, fontFamily: "'DM Sans',sans-serif", padding: "3px 9px", borderRadius: 999, fontWeight: 600, background: p.via ? "#FFF0E6" : "#EEF4F0", color: p.via ? COLORS.terracotta : COLORS.green }}>{p.owner.split(" ")[0]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- BOOKSHELF DETAIL ----
function ShelfScreen({ shelf, onBack, onBook }) {
  const [search, setSearch] = useState("");
  const allBooks = [
    ...shelf.preview,
    { title: "Sapiens", cover: "https://picsum.photos/seed/bk13/80/120", available: true },
    { title: "Atomvaner", cover: "https://picsum.photos/seed/bk14/80/120", available: true },
    { title: "Thinking Fast and Slow", cover: "https://picsum.photos/seed/bk15/80/120", available: true },
    { title: "Normal People", cover: "https://picsum.photos/seed/bk16/80/120", available: false },
    { title: "Station Eleven", cover: "https://picsum.photos/seed/bk17/80/120", available: true },
    { title: "Beloved", cover: "https://picsum.photos/seed/bk18/80/120", available: true },
  ];
  const filtered = search ? allBooks.filter(b => b.title.toLowerCase().includes(search.toLowerCase())) : allBooks;

  return (
    <div style={{ background: COLORS.cream, minHeight: "100%" }}>
      {/* Header */}
      <div style={{ padding: "24px 20px 16px", background: COLORS.cream, borderBottom: `1px solid ${COLORS.sand}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: COLORS.darkBrown, padding: 0 }}>←</button>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.terracotta, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.white, fontFamily: "'Lora',serif", fontWeight: 700, fontSize: 14 }}>{shelf.avatar}</div>
          <div>
            <div style={{ fontFamily: "'Lora',serif", fontSize: 17, fontWeight: 700, color: COLORS.darkBrown }}>{shelf.owner.split(" ")[0]}s bokhylle</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: COLORS.lightText }}>{shelf.availableBooks} av {shelf.totalBooks} tilgjengelig</div>
          </div>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Søk i bokhyllen…"
          style={{ width: "100%", background: COLORS.white, border: `1.5px solid ${COLORS.sand}`, borderRadius: 12, padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.darkBrown, outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* Genre tags */}
      <div style={{ display: "flex", gap: 8, padding: "12px 14px 0", overflowX: "auto" }}>
        {shelf.genres.map(g => <Badge key={g} color="#FFF0E8">{g}</Badge>)}
      </div>

      {/* Books grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "12px 14px 80px" }}>
        {filtered.map((book, i) => (
          <div key={i} onClick={() => onBook({ ...book, owner: shelf.owner, via: shelf.via, avatar: shelf.avatar })} style={{ cursor: "pointer" }}>
            <div style={{ position: "relative", marginBottom: 6 }}>
              <img src={book.cover} alt={book.title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 6, display: "block", opacity: book.available ? 1 : 0.45 }} />
              {!book.available && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "rgba(44,26,14,0.2)" }}>
                  <span style={{ fontSize: 18 }}>🔒</span>
                </div>
              )}
              {book.available && (
                <div style={{ position: "absolute", bottom: 4, right: 4, width: 10, height: 10, borderRadius: "50%", background: COLORS.green, border: `2px solid ${COLORS.white}` }} />
              )}
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: COLORS.darkBrown, lineHeight: 1.3, fontWeight: 500 }}>{book.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- BOOK DETAIL ----
function BookScreen({ book, onBack, onChat }) {
  return (
    <div style={{ background: COLORS.cream, minHeight: "100%" }}>
      <div style={{ position: "relative", background: COLORS.darkBrown, padding: "48px 20px 32px", display: "flex", gap: 20, alignItems: "flex-end" }}>
        <button onClick={onBack} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: COLORS.white }}>←</button>
        <img src={book.cover} alt={book.title} style={{ width: 90, height: 135, objectFit: "cover", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 18, fontWeight: 700, color: COLORS.white, lineHeight: 1.2, marginBottom: 4 }}>{book.title}</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Fra {book.owner.split(" ")[0]}s bokhylle</div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 100px" }}>
        {/* Owner */}
        <div style={{ background: COLORS.white, borderRadius: 14, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(44,26,14,0.06)" }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: COLORS.terracotta, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.white, fontFamily: "'Lora',serif", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{book.avatar}</div>
          <div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: COLORS.darkBrown }}>{book.owner}</div>
            {book.via
              ? <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.lightText }}>Via <span style={{ color: COLORS.terracotta, fontWeight: 600 }}>{book.via}</span></div>
              : <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.green, fontWeight: 500 }}>✓ Direkte venn</div>
            }
          </div>
        </div>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, fontSize: 13, fontFamily: "'DM Sans',sans-serif", color: book.available ? COLORS.green : COLORS.lightText, fontWeight: 500 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: book.available ? COLORS.green : COLORS.lightText }} />
          {book.available ? "Tilgjengelig nå" : "Utlånt for øyeblikket"}
        </div>

        {book.available && (
          <button onClick={onChat} style={{ width: "100%", background: COLORS.terracotta, color: COLORS.white, border: "none", borderRadius: 14, padding: "17px 20px", fontFamily: "'Lora',serif", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(196,103,58,0.35)" }}>
            Spør om å låne
          </button>
        )}
      </div>
    </div>
  );
}

// ---- PRODUCT ----
function ProductScreen({ product, onBack, onChat }) {
  const reachRows = [
    { key: "venner", label: "👥 Venner", value: product.reach.venner },
    { key: "vennerAvVenner", label: "🌐 Venner av venner", value: product.reach.vennerAvVenner },
    { key: "offentlig", label: "🌍 Offentlig", value: product.reach.offentlig },
  ].filter(r => r.value !== null);
  return (
    <div style={{ background: COLORS.cream, minHeight: "100%" }}>
      <div style={{ position: "relative" }}>
        <img src={product.image} alt={product.name} style={{ width: "100%", height: 300, objectFit: "cover", display: "block" }} />
        <button onClick={onBack} style={{ position: "absolute", top: 16, left: 16, background: "rgba(250,247,242,0.92)", border: "none", borderRadius: "50%", width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: COLORS.darkBrown }}>←</button>
      </div>
      <div style={{ padding: "22px 20px 100px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 21, fontWeight: 700, color: COLORS.darkBrown, lineHeight: 1.2, flex: 1, paddingRight: 12 }}>{product.name}</div>
          <Badge>{product.size}</Badge>
        </div>
        <div style={{ background: COLORS.white, borderRadius: 14, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(44,26,14,0.06)" }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: COLORS.terracotta, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.white, fontFamily: "'Lora',serif", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{product.owner[0]}</div>
          <div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: COLORS.darkBrown }}>{product.owner}</div>
            {product.via ? <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.lightText }}>Via <span style={{ color: COLORS.terracotta, fontWeight: 600 }}>{product.via}</span></div> : <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.green, fontWeight: 500 }}>✓ Direkte venn</div>}
          </div>
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: COLORS.mediumBrown, lineHeight: 1.65, marginBottom: 20 }}>{product.description}</div>
        <div style={{ background: COLORS.white, borderRadius: 14, overflow: "hidden", marginBottom: 20, boxShadow: "0 1px 6px rgba(44,26,14,0.06)" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.sand}`, fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.mediumBrown, letterSpacing: "0.05em", textTransform: "uppercase" }}>Utlånsbetingelser</div>
          {reachRows.map((r, i) => (
            <div key={r.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < reachRows.length - 1 ? `1px solid ${COLORS.sand}` : "none" }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.darkBrown }}>{r.label}</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: r.value === "gratis" ? COLORS.green : COLORS.terracotta }}>{r.value === "gratis" ? "✓ Gratis" : r.value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, fontSize: 13, color: product.available ? COLORS.green : COLORS.lightText, fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: product.available ? COLORS.green : COLORS.lightText }} />
          {product.available ? "Tilgjengelig nå" : "Utlånt for øyeblikket"}
        </div>
        {product.available && (
          <button onClick={onChat} style={{ width: "100%", background: COLORS.terracotta, color: COLORS.white, border: "none", borderRadius: 14, padding: "17px 20px", fontFamily: "'Lora',serif", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(196,103,58,0.35)" }}>
            Spør om å låne
          </button>
        )}
      </div>
    </div>
  );
}

// ---- CHAT ----
function ChatScreen({ item, onBack }) {
  const name = item.owner ? item.owner.split(" ")[0] : "?";
  const itemName = item.title || item.name;
  const suggested = `Hei ${name}! Jeg så at du har "${itemName}" – er det mulig å låne den? 😊`;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(suggested);
  const [dismissed, setDismissed] = useState(false);
  const isSuggestion = !dismissed && draft === suggested;
  const send = () => {
    if (!draft.trim()) return;
    setMessages(m => [...m, { from: "me", text: draft, time: new Date().toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" }) }]);
    setDraft(""); setDismissed(true);
  };
  return (
    <div style={{ background: COLORS.cream, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 14px", background: COLORS.white, borderBottom: `1px solid ${COLORS.sand}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: COLORS.darkBrown, padding: 0 }}>←</button>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.sand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {item.cover ? <img src={item.cover} style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} alt="" /> : "📦"}
        </div>
        <div>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 14, fontWeight: 700, color: COLORS.darkBrown }}>{name}</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: COLORS.lightText, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemName}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && <div style={{ textAlign: "center", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.lightText, padding: "20px 0" }}>Ingen meldinger enda 👇</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ maxWidth: "72%", background: COLORS.terracotta, color: COLORS.white, borderRadius: "18px 18px 4px 18px", padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 14, lineHeight: 1.45 }}>
              {m.text}<div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: "right" }}>{m.time}</div>
            </div>
          </div>
        ))}
      </div>
      {isSuggestion && (
        <div style={{ margin: "0 14px 8px", background: "#FFF8F4", border: `1px solid ${COLORS.sand}`, borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span>💡</span>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.mediumBrown, flex: 1 }}>Forslag til melding – rediger eller send direkte</span>
          <button onClick={() => { setDraft(""); setDismissed(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.lightText, fontSize: 16, padding: 0 }}>×</button>
        </div>
      )}
      <div style={{ padding: "10px 14px 16px", background: COLORS.white, borderTop: `1px solid ${COLORS.sand}`, display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={isSuggestion ? 3 : 1} placeholder="Skriv en melding…" style={{ flex: 1, background: COLORS.cream, border: `1.5px solid ${isSuggestion ? COLORS.terracotta : COLORS.sand}`, borderRadius: 14, padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: COLORS.darkBrown, outline: "none", resize: "none", lineHeight: 1.5 }} />
        <button onClick={send} style={{ background: draft.trim() ? COLORS.terracotta : COLORS.sand, border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", color: COLORS.white, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>↑</button>
      </div>
    </div>
  );
}

// ---- KRETSEN SPØR ----
function KretsenSpørScreen({ onAsk, onReply }) {
  const [activeFilter, setActiveFilter] = useState("alle");
  const filtered = activeFilter === "alle" ? wishes : wishes.filter(w => w.category === activeFilter);
  return (
    <div style={{ background: COLORS.cream, minHeight: "100%", paddingBottom: 80 }}>
      <div style={{ padding: "28px 20px 16px", background: COLORS.cream, borderBottom: `1px solid ${COLORS.sand}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Lora',serif", fontSize: 22, fontWeight: 700, color: COLORS.darkBrown }}>Kretsen spør</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.lightText, marginTop: 1 }}>Hva leter vennene dine etter?</div>
          </div>
          <button onClick={onAsk} style={{ background: COLORS.terracotta, border: "none", borderRadius: 999, padding: "8px 16px", color: COLORS.white, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Spør</button>
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {["alle", "kjole", "baby", "verktøy", "bok"].map(c => (
            <Pill key={c} label={c === "alle" ? "Alle" : c === "kjole" ? "👗" : c === "baby" ? "🍼" : c === "verktøy" ? "🔧" : "📚"} active={activeFilter === c} onClick={() => setActiveFilter(c)} small />
          ))}
        </div>
      </div>
      <div style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(wish => (
          <div key={wish.id} style={{ background: COLORS.white, borderRadius: 16, padding: "16px", boxShadow: "0 2px 8px rgba(44,26,14,0.06)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: COLORS.terracotta, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.white, fontFamily: "'Lora',serif", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{wish.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: COLORS.darkBrown }}>{wish.from.split(" ")[0]}</span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: COLORS.lightText }}>{wish.time}</span>
                </div>
                {wish.via && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: COLORS.lightText, marginBottom: 4 }}>via {wish.via.split(" ")[0]}</div>}
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: COLORS.mediumBrown, lineHeight: 1.5, margin: 0 }}>{wish.text}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Badge color="#FFF0E8">{categoryEmoji[wish.category] || "📦"} {wish.category.charAt(0).toUpperCase() + wish.category.slice(1)}</Badge>
              <button onClick={() => onReply(wish)} style={{ background: COLORS.terracotta, color: COLORS.white, border: "none", borderRadius: 999, padding: "7px 16px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Jeg har dette! →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- ASK ----
function AskScreen({ onBack }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("baby");
  const [reach, setReach] = useState("venner");
  const [sent, setSent] = useState(false);
  return (
    <div style={{ background: COLORS.cream, minHeight: "100%" }}>
      <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${COLORS.sand}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: COLORS.darkBrown }}>←</button>
        <div style={{ fontFamily: "'Lora',serif", fontSize: 19, fontWeight: 700, color: COLORS.darkBrown }}>Spør kretsen</div>
      </div>
      <div style={{ padding: "24px 20px" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🙌</div>
            <div style={{ fontFamily: "'Lora',serif", fontSize: 18, fontWeight: 700, color: COLORS.darkBrown, marginBottom: 8 }}>Spørsmål sendt!</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: COLORS.lightText, marginBottom: 28 }}>Kretsen din blir varslet. De som har det du leter etter vil svare deg direkte.</div>
            <button onClick={onBack} style={{ background: COLORS.terracotta, color: COLORS.white, border: "none", borderRadius: 14, padding: "14px 32px", fontFamily: "'Lora',serif", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Tilbake</button>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.mediumBrown, lineHeight: 1.6, marginBottom: 24 }}>Send en melding til kretsen din. De som har det svarer deg direkte.</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: COLORS.mediumBrown, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>Kategori</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {["kjole", "baby", "verktøy", "bok"].map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{ padding: "9px 14px", borderRadius: 12, border: category === c ? "none" : `1.5px solid ${COLORS.sand}`, background: category === c ? COLORS.darkBrown : COLORS.white, color: category === c ? COLORS.white : COLORS.mediumBrown, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: category === c ? 600 : 400, cursor: "pointer" }}>
                  {c === "kjole" ? "👗 Kjole" : c === "baby" ? "🍼 Baby" : c === "verktøy" ? "🔧 Verktøy" : "📚 Bok"}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: COLORS.mediumBrown, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>Meldingen din</div>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder={category === "bok" ? "F.eks. «Noen som har Sapiens eller noe av Harari?»" : category === "baby" ? "F.eks. «Leter etter vippestol til 3 mnd»" : "F.eks. «Trenger lang kjole til bryllup, str 38»"} rows={4} style={{ width: "100%", background: COLORS.white, border: `1.5px solid ${COLORS.sand}`, borderRadius: 14, padding: "12px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: COLORS.darkBrown, outline: "none", resize: "none", lineHeight: 1.5, boxSizing: "border-box", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              {["venner", "vennerAvVenner"].map(r => (
                <button key={r} onClick={() => setReach(r)} style={{ flex: 1, padding: "11px 8px", borderRadius: 12, border: reach === r ? "none" : `1.5px solid ${COLORS.sand}`, background: reach === r ? COLORS.darkBrown : COLORS.white, color: reach === r ? COLORS.white : COLORS.mediumBrown, fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: reach === r ? 600 : 400, cursor: "pointer" }}>
                  {r === "venner" ? "🔒 Kun venner" : "🌐 Venner av venner"}
                </button>
              ))}
            </div>
            <button onClick={() => text.trim() && setSent(true)} style={{ width: "100%", background: text.trim() ? COLORS.terracotta : COLORS.sand, color: COLORS.white, border: "none", borderRadius: 14, padding: "17px 20px", fontFamily: "'Lora',serif", fontSize: 16, fontWeight: 700, cursor: text.trim() ? "pointer" : "default" }}>
              Send til kretsen
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---- ADD ITEM (with book scan) ----
function AddScreen({ onBack }) {
  const [mode, setMode] = useState(null); // null | 'url' | 'book'
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [fetched, setFetched] = useState(null);
  const [bookScanStep, setBookScanStep] = useState("camera"); // camera | scanning | confirm
  const [selectedBooks, setSelectedBooks] = useState(scannedBooks.map(b => ({ ...b })));
  const [groups, setGroups] = useState({ venner: { active: true, compensation: "gratis" }, vennerAvVenner: { active: false, compensation: "" }, offentlig: { active: false, compensation: "" } });

  const simulateFetch = () => {
    if (!url.trim()) return;
    setLoading(true); setFetched(null);
    setLoadingStep("Henter siden…");
    setTimeout(() => setLoadingStep("Finner produktinfo…"), 700);
    setTimeout(() => setLoadingStep("Henter bilde…"), 1300);
    setTimeout(() => {
      let result = urlFetchResults.default;
      if (url.includes("stokke")) result = urlFetchResults.stokke;
      else if (url.includes("kjole") || url.includes("dress")) result = urlFetchResults.kjole;
      else if (url.includes("bosch") || url.includes("drill")) result = urlFetchResults.bosch;
      setFetched(result); setLoading(false); setLoadingStep("");
    }, 1800);
  };

  const startBookScan = () => {
    setBookScanStep("scanning");
    setTimeout(() => setBookScanStep("confirm"), 2200);
  };

  const toggleBook = (id) => {
    setSelectedBooks(books => books.map(b => b.id === id ? { ...b, selected: !b.selected } : b));
  };

  const groupLabels = { venner: "👥 Venner", vennerAvVenner: "🌐 Venner av venner", offentlig: "🌍 Offentlig" };
  const selectedCount = selectedBooks.filter(b => b.selected).length;

  if (mode === "book") {
    return (
      <div style={{ background: COLORS.cream, minHeight: "100%", paddingBottom: 80 }}>
        <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${COLORS.sand}`, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => { setMode(null); setBookScanStep("camera"); }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: COLORS.darkBrown }}>←</button>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 19, fontWeight: 700, color: COLORS.darkBrown }}>📚 Legg ut bøker</div>
        </div>
        <div style={{ padding: "24px 20px" }}>
          {bookScanStep === "camera" && (
            <>
              <div style={{ background: COLORS.darkBrown, borderRadius: 20, aspectRatio: "4/3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20, position: "relative", overflow: "hidden" }}>
                {/* Simulated camera viewfinder */}
                <div style={{ position: "absolute", inset: 20, border: `2px solid rgba(255,255,255,0.3)`, borderRadius: 12 }} />
                <div style={{ position: "absolute", top: 28, left: 28, width: 20, height: 20, borderTop: `3px solid ${COLORS.terracotta}`, borderLeft: `3px solid ${COLORS.terracotta}`, borderRadius: "4px 0 0 0" }} />
                <div style={{ position: "absolute", top: 28, right: 28, width: 20, height: 20, borderTop: `3px solid ${COLORS.terracotta}`, borderRight: `3px solid ${COLORS.terracotta}`, borderRadius: "0 4px 0 0" }} />
                <div style={{ position: "absolute", bottom: 28, left: 28, width: 20, height: 20, borderBottom: `3px solid ${COLORS.terracotta}`, borderLeft: `3px solid ${COLORS.terracotta}`, borderRadius: "0 0 0 4px" }} />
                <div style={{ position: "absolute", bottom: 28, right: 28, width: 20, height: 20, borderBottom: `3px solid ${COLORS.terracotta}`, borderRight: `3px solid ${COLORS.terracotta}`, borderRadius: "0 0 4px 0" }} />
                <span style={{ fontSize: 48 }}>📚</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "center", paddingLeft: 40, paddingRight: 40 }}>Rett kameraet mot bokhyllen din</span>
              </div>
              <button onClick={startBookScan} style={{ width: "100%", background: COLORS.terracotta, color: COLORS.white, border: "none", borderRadius: 14, padding: "17px 20px", fontFamily: "'Lora',serif", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(196,103,58,0.35)" }}>
                📸 Ta bilde av bokhyllen
              </button>
            </>
          )}

          {bookScanStep === "scanning" && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>🔍</div>
              <div style={{ fontFamily: "'Lora',serif", fontSize: 18, fontWeight: 700, color: COLORS.darkBrown, marginBottom: 8 }}>Analyserer bokhyllen…</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.lightText }}>AI gjenkjenner titler og forfattere</div>
              <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.terracotta, opacity: 0.3, animation: `pulse 1.2s ease-in-out ${i * 0.3}s infinite` }} />
                ))}
              </div>
              <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
            </div>
          )}

          {bookScanStep === "confirm" && (
            <>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.green, fontWeight: 600, marginBottom: 4 }}>✓ Fant {scannedBooks.length} bøker!</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.lightText, marginBottom: 16 }}>Velg hvilke du vil låne ut. Feil tittel? Trykk for å redigere.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                {selectedBooks.map(book => (
                  <div key={book.id} onClick={() => toggleBook(book.id)} style={{ cursor: "pointer", opacity: book.selected ? 1 : 0.4, transition: "opacity 0.15s" }}>
                    <div style={{ position: "relative", marginBottom: 5 }}>
                      <img src={book.cover} alt={book.title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 6, display: "block" }} />
                      {book.selected && (
                        <div style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%", background: COLORS.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: COLORS.white, fontSize: 11, fontWeight: 700 }}>✓</span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, color: COLORS.darkBrown, lineHeight: 1.3 }}>{book.author}</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: COLORS.mediumBrown, fontWeight: 600, lineHeight: 1.3 }}>{book.title}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.mediumBrown, marginBottom: 20, textAlign: "center" }}>
                <span style={{ fontWeight: 700, color: COLORS.darkBrown }}>{selectedCount}</span> bøker valgt
              </div>
              <button onClick={onBack} style={{ width: "100%", background: selectedCount > 0 ? COLORS.terracotta : COLORS.sand, color: COLORS.white, border: "none", borderRadius: 14, padding: "17px 20px", fontFamily: "'Lora',serif", fontSize: 16, fontWeight: 700, cursor: selectedCount > 0 ? "pointer" : "default", boxShadow: selectedCount > 0 ? "0 4px 16px rgba(196,103,58,0.35)" : "none" }}>
                Legg ut {selectedCount} bøker
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.cream, minHeight: "100%", paddingBottom: 80 }}>
      <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${COLORS.sand}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: COLORS.darkBrown }}>←</button>
        <div style={{ fontFamily: "'Lora',serif", fontSize: 19, fontWeight: 700, color: COLORS.darkBrown }}>Legg ut noe</div>
      </div>
      <div style={{ padding: "24px 20px" }}>

        {/* Book shortcut */}
        <div onClick={() => setMode("book")} style={{ background: COLORS.darkBrown, borderRadius: 14, padding: "16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
          <span style={{ fontSize: 32 }}>📚</span>
          <div>
            <div style={{ fontFamily: "'Lora',serif", fontSize: 15, fontWeight: 700, color: COLORS.white }}>Legg ut bøker</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>Ta bilde av bokhyllen – AI registrerer alle titlene</div>
          </div>
          <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: 18 }}>→</span>
        </div>

        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: COLORS.mediumBrown, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>Lim inn produktlenke</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && simulateFetch()} placeholder="https://nettbutikk.no/produkt..." style={{ flex: 1, background: COLORS.white, border: `1.5px solid ${url ? COLORS.terracotta : COLORS.sand}`, borderRadius: 12, padding: "12px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.darkBrown, outline: "none" }} />
          <button onClick={simulateFetch} disabled={loading} style={{ background: loading ? COLORS.sand : COLORS.terracotta, color: COLORS.white, border: "none", borderRadius: 12, padding: "0 18px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer", minWidth: 60 }}>
            {loading ? "…" : "Hent"}
          </button>
        </div>

        {loading && (
          <div style={{ marginTop: 16, background: COLORS.white, borderRadius: 14, padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${COLORS.sand}`, borderTopColor: COLORS.terracotta, animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: COLORS.darkBrown }}>{loadingStep}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: COLORS.lightText }}>Henter produktinfo automatisk</div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", margin: "14px 0", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.lightText }}>— eller —</div>
        <button style={{ width: "100%", background: COLORS.white, border: `1.5px dashed ${COLORS.sand}`, borderRadius: 12, padding: "14px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.lightText, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>📷 Ta bilde manuelt</button>

        {fetched && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.green, fontWeight: 600, marginBottom: 10 }}>
              ✓ Hentet fra <span style={{ color: COLORS.mediumBrown }}>{fetched.source}</span>
            </div>
            <div style={{ background: COLORS.white, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(44,26,14,0.08)", marginBottom: 24 }}>
              <img src={fetched.image} alt="" style={{ width: "100%", height: 160, objectFit: "cover" }} />
              <div style={{ padding: "14px 16px" }}>
                <div style={{ fontFamily: "'Lora',serif", fontSize: 15, fontWeight: 700, color: COLORS.darkBrown, marginBottom: 4 }}>{fetched.name}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.mediumBrown, lineHeight: 1.5 }}>{fetched.description}</div>
              </div>
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: COLORS.mediumBrown, marginBottom: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>Hvem kan låne og til hvilken pris?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {Object.entries(groups).map(([key, val]) => (
                <div key={key} style={{ background: COLORS.white, borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 4px rgba(44,26,14,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: val.active ? 10 : 0 }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: COLORS.darkBrown }}>{groupLabels[key]}</span>
                    <button onClick={() => setGroups(g => ({ ...g, [key]: { ...g[key], active: !g[key].active } }))} style={{ width: 44, height: 24, borderRadius: 999, border: "none", background: val.active ? COLORS.terracotta : COLORS.sand, cursor: "pointer", position: "relative" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: COLORS.white, position: "absolute", top: 3, left: val.active ? 23 : 3, transition: "left 0.15s" }} />
                    </button>
                  </div>
                  {val.active && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["gratis", "50 kr", "100 kr", "200 kr", "500 kr"].map(opt => (
                        <button key={opt} onClick={() => setGroups(g => ({ ...g, [key]: { ...g[key], compensation: opt } }))} style={{ padding: "5px 10px", borderRadius: 999, border: val.compensation === opt ? "none" : `1px solid ${COLORS.sand}`, background: val.compensation === opt ? COLORS.darkBrown : COLORS.white, color: val.compensation === opt ? COLORS.white : COLORS.mediumBrown, fontFamily: "'DM Sans',sans-serif", fontSize: 12, cursor: "pointer" }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={onBack} style={{ width: "100%", background: COLORS.terracotta, color: COLORS.white, border: "none", borderRadius: 14, padding: "17px 20px", fontFamily: "'Lora',serif", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(196,103,58,0.35)" }}>
              Publiser
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ---- REPLY ----
function ReplyScreen({ wish, onBack }) {
  const suggested = `Hei ${wish.from.split(" ")[0]}! Jeg så at du leter – jeg har faktisk det du trenger 😊`;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(suggested);
  const [dismissed, setDismissed] = useState(false);
  const isSuggestion = !dismissed && draft === suggested;
  const send = () => {
    if (!draft.trim()) return;
    setMessages(m => [...m, { from: "me", text: draft, time: new Date().toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" }) }]);
    setDraft(""); setDismissed(true);
  };
  return (
    <div style={{ background: COLORS.cream, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 14px", background: COLORS.white, borderBottom: `1px solid ${COLORS.sand}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: COLORS.darkBrown, padding: 0 }}>←</button>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: COLORS.terracotta, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.white, fontFamily: "'Lora',serif", fontWeight: 700, fontSize: 14 }}>{wish.avatar}</div>
        <div>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 14, fontWeight: 700, color: COLORS.darkBrown }}>{wish.from.split(" ")[0]}</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: COLORS.lightText, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wish.text}</div>
        </div>
      </div>
      <div style={{ margin: "12px 14px 0", background: "#FFF8F4", border: `1px solid ${COLORS.sand}`, borderRadius: 12, padding: "10px 14px" }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: COLORS.lightText, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ønsket</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: COLORS.mediumBrown }}>{wish.text}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && <div style={{ textAlign: "center", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.lightText, padding: "16px 0" }}>Svar {wish.from.split(" ")[0]} direkte 👇</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ maxWidth: "72%", background: COLORS.terracotta, color: COLORS.white, borderRadius: "18px 18px 4px 18px", padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 14, lineHeight: 1.45 }}>
              {m.text}<div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: "right" }}>{m.time}</div>
            </div>
          </div>
        ))}
      </div>
      {isSuggestion && (
        <div style={{ margin: "0 14px 8px", background: "#FFF8F4", border: `1px solid ${COLORS.sand}`, borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span>💡</span>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: COLORS.mediumBrown, flex: 1 }}>Forslag til melding – rediger eller send direkte</span>
          <button onClick={() => { setDraft(""); setDismissed(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.lightText, fontSize: 16, padding: 0 }}>×</button>
        </div>
      )}
      <div style={{ padding: "10px 14px 16px", background: COLORS.white, borderTop: `1px solid ${COLORS.sand}`, display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={isSuggestion ? 3 : 1} placeholder="Skriv en melding…" style={{ flex: 1, background: COLORS.cream, border: `1.5px solid ${isSuggestion ? COLORS.terracotta : COLORS.sand}`, borderRadius: 14, padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: COLORS.darkBrown, outline: "none", resize: "none", lineHeight: 1.5 }} />
        <button onClick={send} style={{ background: draft.trim() ? COLORS.terracotta : COLORS.sand, border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", color: COLORS.white, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>↑</button>
      </div>
    </div>
  );
}

// ---- NAV ----
const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 0", position: "relative" }}>
    <span style={{ fontSize: 20 }}>{icon}</span>
    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: active ? 700 : 400, color: active ? COLORS.terracotta : COLORS.lightText }}>{label}</span>
    {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.terracotta }} />}
    {badge && <div style={{ position: "absolute", top: 4, right: "calc(50% - 18px)", width: 16, height: 16, borderRadius: "50%", background: COLORS.terracotta, color: COLORS.white, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</div>}
  </button>
);

// ---- APP ----
export default function App() {
  const [screen, setScreen] = useState("feed");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedWish, setSelectedWish] = useState(null);
  const [chatItem, setChatItem] = useState(null);
  const [nav, setNav] = useState("utforsk");

  const goFeed = () => { setScreen("feed"); setNav("utforsk"); };
  const goKretsen = () => { setScreen("kretsen"); setNav("kretsen"); };
  const goAdd = () => { setScreen("add"); setNav("add"); };

  const showNav = ["feed", "add", "kretsen"].includes(screen);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "linear-gradient(135deg, #2C1A0E 0%, #6B4226 100%)", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ width: 375, height: 760, background: COLORS.cream, borderRadius: 44, overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 10px #1a0f06", display: "flex", flexDirection: "column" }}>
        <div style={{ background: COLORS.cream, padding: "10px 24px 0", display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: COLORS.darkBrown, flexShrink: 0 }}>
          <span>9:41</span><span>●●● ▲ ▊</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {screen === "feed" && <FeedScreen onProduct={p => { setSelectedProduct(p); setScreen("product"); }} onAsk={() => setScreen("ask")} onShelf={s => { setSelectedShelf(s); setScreen("shelf"); }} />}
          {screen === "product" && selectedProduct && <ProductScreen product={selectedProduct} onBack={goFeed} onChat={() => { setChatItem(selectedProduct); setScreen("chat"); }} />}
          {screen === "shelf" && selectedShelf && <ShelfScreen shelf={selectedShelf} onBack={goFeed} onBook={b => { setSelectedBook(b); setScreen("book"); }} />}
          {screen === "book" && selectedBook && <BookScreen book={selectedBook} onBack={() => setScreen("shelf")} onChat={() => { setChatItem(selectedBook); setScreen("chat"); }} />}
          {screen === "chat" && chatItem && <ChatScreen item={chatItem} onBack={() => setScreen(selectedBook ? "book" : "product")} />}
          {screen === "kretsen" && <KretsenSpørScreen onAsk={() => setScreen("ask")} onReply={w => { setSelectedWish(w); setScreen("reply"); }} />}
          {screen === "ask" && <AskScreen onBack={() => nav === "kretsen" ? goKretsen() : goFeed()} />}
          {screen === "reply" && selectedWish && <ReplyScreen wish={selectedWish} onBack={() => setScreen("kretsen")} />}
          {screen === "add" && <AddScreen onBack={goFeed} />}
        </div>
        {showNav && (
          <div style={{ background: COLORS.white, borderTop: `1px solid ${COLORS.sand}`, display: "flex", padding: "4px 0 8px", flexShrink: 0 }}>
            <NavItem icon="🔍" label="Utforsk" active={nav === "utforsk"} onClick={goFeed} />
            <NavItem icon="🙋" label="Kretsen spør" active={nav === "kretsen"} onClick={goKretsen} badge={wishes.length} />
            <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
              <button onClick={goAdd} style={{ width: 48, height: 48, background: COLORS.terracotta, border: "none", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: COLORS.white, boxShadow: "0 4px 14px rgba(196,103,58,0.4)", marginBottom: 4 }}>+</button>
            </div>
            <NavItem icon="💬" label="Meldinger" active={nav === "meldinger"} onClick={() => setNav("meldinger")} />
            <NavItem icon="👤" label="Profil" active={nav === "profil"} onClick={() => setNav("profil")} />
          </div>
        )}
      </div>
    </div>
  );
}
