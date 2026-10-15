import Cover from './Cover.jsx';

export default function Shelves({ me, onExplore, onToggleWant, onEditFavorites }) {
  return (
    <section className="shelves">
      <h2>My Books</h2>
      <div className="shelf">
        <div className="fav-strip-head"><h3>⭐ Favourites <span className="m">({me.favorites.length})</span></h3><button className="link" onClick={onEditFavorites}>Edit</button></div>
        <div className="shelf-grid">
          {me.favorites.map((b) => (
            <div key={b.isbn} className="shelf-book" onClick={() => onExplore(b)}>
              <Cover src={b.imageM} size="lg" title={b.title} />
              <div className="t">{b.title}</div><div className="m">{b.author}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="shelf">
        <h3>📖 Want to Read <span className="m">({me.wantToRead.length})</span></h3>
        {me.wantToRead.length === 0 && <p className="m">Nothing here yet — add books from your recommendations with “+ Want to Read”.</p>}
        <div className="shelf-grid">
          {me.wantToRead.map((b) => (
            <div key={b.isbn} className="shelf-book" onClick={() => onExplore(b)}>
              <Cover src={b.imageM} size="lg" title={b.title} />
              <div className="t">{b.title}</div><div className="m">{b.author}</div>
              <button className="link muted" onClick={(e) => { e.stopPropagation(); onToggleWant(b, true); }}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
