import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    isbn: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    author: { type: String, default: '' },
    year: { type: Number, default: null },
    publisher: { type: String, default: '' },
    imageS: String,
    imageM: String,
    imageL: String,
  },
  { versionKey: false }
);

bookSchema.index({ title: 'text', author: 'text' });
bookSchema.index({ author: 1 });

export default mongoose.model('Book', bookSchema);
