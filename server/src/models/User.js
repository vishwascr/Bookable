import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_.-]{3,30}$/ },
    displayName: { type: String, trim: true, maxlength: 60 },
    passwordHash: { type: String, required: true },
    favorites: { type: [String], default: [] }, // ISBNs picked at onboarding (3–5)
    wantToRead: { type: [String], default: [] }, // ISBNs saved from recommendations
  },
  { timestamps: true, versionKey: false }
);

userSchema.virtual('onboarded').get(function () {
  return this.favorites.length >= 3;
});

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    username: this.username,
    displayName: this.displayName || this.username,
    favorites: this.favorites,
    wantToRead: this.wantToRead,
    onboarded: this.onboarded,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
