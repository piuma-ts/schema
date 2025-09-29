import { number, string, boolean, object, discriminatedUnion, intersection, array, union, literal } from 'zod';
import { testData } from './example-data';

function makeSchema() {
  // Basic primitive schemas
  const IntegerSchema = number();
  const AtomDateSchema = string(); // AtomDate is a tagged string
  const WallItemIdSchema = string();

  // Base schemas
  const VideoSchema = object({
    key: string(),
    uri: string(),
    width: IntegerSchema,
    height: IntegerSchema,
  });

  const ImageSchema = VideoSchema.extend({
    isBlurred: boolean(),
    mainColor: string(),
  });

  const WallItemBaseSchema = object({
    id: WallItemIdSchema,
    createdAt: AtomDateSchema,
  });

  const Privacy = discriminatedUnion('privacy', [
    object({ privacy: literal('public') }),
    object({ privacy: literal('exclusive'), isUnlocked: boolean(), price: IntegerSchema }),
  ]);

  // Individual RawWallItem schemas with proper union handling
  const RawPhotoSchema = intersection(
    WallItemBaseSchema.extend({
      type: literal('photo'),
      albumId: WallItemIdSchema,
      versions: array(ImageSchema),
    }),
    Privacy
  );

  const RawNoteSchema = intersection(
    WallItemBaseSchema.extend({
      type: literal('note'),
      content: string(),
    }),
    Privacy
  );

  const RawAlbumSchema = intersection(
    WallItemBaseSchema.extend({
      type: literal('album'),
      title: string(),
      content: array(
        WallItemBaseSchema.extend({
          versions: array(ImageSchema),
        })
      ),
    }),
    Privacy
  );

  const RawVideoSchema = intersection(
    WallItemBaseSchema.extend({
      type: literal('video'),
      caption: string(),
      duration: IntegerSchema,
      previews: array(ImageSchema),
    }),
    Privacy
  );

  // Main RawWallItem schema using union instead of discriminated union
  const RawWallItemSchema = union([RawPhotoSchema, RawAlbumSchema, RawVideoSchema, RawNoteSchema]);
  const RawWallData = array(RawWallItemSchema);

  return RawWallData;
}

const schema = makeSchema();

export function schemaCreation(iterations: number) {
  for (let i = 0; i < iterations; i++) makeSchema();
}

export function validation(iterations: number) {
  for (let i = 0; i < iterations; i++) schema.safeParse(testData);
}
