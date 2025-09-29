import { type } from 'arktype';
import { testData } from './example-data';

function makeSchema() {
  const ImageSchema = type({
    key: 'string',
    uri: 'string',
    width: 'number',
    height: 'number',
    isBlurred: 'boolean',
    mainColor: 'string',
  });

  const Visibility = type({
    privacy: "'public'",
  }).or({
    privacy: "'exclusive'",
    isUnlocked: 'boolean',
    price: 'number',
  });

  const WallItemBaseSchema = type({
    id: 'string',
    createdAt: 'string',
  }).and(Visibility);

  const RawPhotoSchema = type({
    type: "'photo'",
    albumId: 'string',
    versions: ImageSchema.array(),
  }).and(WallItemBaseSchema);

  const RawNoteSchema = type({
    type: "'note'",
    content: 'string',
  }).and(WallItemBaseSchema);

  const RawAlbumSchema = type({
    type: "'album'",
    title: 'string',
    content: type({
      id: 'string',
      createdAt: 'string',
      versions: ImageSchema.array(),
    }).array(),
  }).and(WallItemBaseSchema);

  const RawVideoSchema = type({
    type: "'video'",
    caption: 'string',
    duration: 'number',
    previews: ImageSchema.array(),
  }).and(WallItemBaseSchema);

  const RawWallItemSchema = RawPhotoSchema.or(RawAlbumSchema).or(RawVideoSchema).or(RawNoteSchema);
  const RawWallData = RawWallItemSchema.array();

  return RawWallData;
}

const schema = makeSchema();

export function schemaCreation(iterations: number) {
  for (let i = 0; i < iterations; i++) makeSchema();
}

export function validation(iterations: number) {
  for (let i = 0; i < iterations; i++) schema(testData);
}
