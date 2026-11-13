import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      default: '',
      trim: true,
    },
    isbn: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer rating between 1 and 5',
      },
    },
    text: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    sentiment: {
      score: {
        type: Number,
        default: 0,
      },
      label: {
        type: String,
        enum: ['positive', 'neutral', 'negative'],
        default: 'neutral',
      },
      keywords: {
        type: [String],
        default: [],
      },
    },
  },
  { timestamps: true, versionKey: false }
);

// One review per user per book
reviewSchema.index({ userId: 1, isbn: 1 }, { unique: true });
// Fast query for book reviews sorted newest first
reviewSchema.index({ isbn: 1, createdAt: -1 });
// Fast query for user's reviews sorted newest first
reviewSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
