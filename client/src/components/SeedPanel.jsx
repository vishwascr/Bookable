import Cover from './Cover.jsx';

export default function SeedPanel({ seed }) {
  const { book, terms } = seed;
  return (
    <section className="card seed">
      <h3>Seed book</h3>
      <div className="seed-row">
        <Cover src={book.imageM} title={book.title} />
        <div>
          <div className="t">{book.title}</div>
          <div className="m">{book.author}</div>
          <div className="m">{book.year || 'n/a'} · {book.publisher}</div>
          <div className="m mono">ISBN {book.isbn}</div>
        </div>
      </div>
      <h4>TF-IDF title terms</h4>
      <div className="terms">
        {terms.length ? terms.map((t) => (
          <span key={t.term} className="term" title={`idf ${t.idf}`}>
            {t.term} <b>{t.weight}</b>
          </span>
        )) : <span className="m">No meaningful title terms.</span>}
      </div>
    </section>
  );
}
