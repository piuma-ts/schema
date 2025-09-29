import { z } from 'zod';
import { testData } from './example-data';

function makeSchema() {
  // Basic primitive schemas
  const IntegerSchema = z.number();
  const AtomDateSchema = z.string(); // AtomDate is a tagged string
  const WallItemIdSchema = z.string();

  // Base schemas
  const VideoSchema = z.object({
    key: z.string(),
    uri: z.string(),
    width: IntegerSchema,
    height: IntegerSchema,
  });

  const ImageSchema = VideoSchema.extend({
    isBlurred: z.boolean(),
    mainColor: z.string(),
  });

  const WallItemBaseSchema = z.object({
    id: WallItemIdSchema,
    createdAt: AtomDateSchema,
  });

  const Privacy = z.discriminatedUnion('privacy', [
    z.object({ privacy: z.literal('public') }),
    z.object({ privacy: z.literal('exclusive'), isUnlocked: z.boolean(), price: IntegerSchema }),
  ]);

  // Individual RawWallItem schemas with proper union handling
  const RawPhotoSchema = z.intersection(
    WallItemBaseSchema.extend({
      type: z.literal('photo'),
      albumId: WallItemIdSchema,
      versions: z.array(ImageSchema),
    }),
    Privacy
  );

  const RawNoteSchema = z.intersection(
    WallItemBaseSchema.extend({
      type: z.literal('note'),
      content: z.string(),
    }),
    Privacy
  );

  const RawAlbumSchema = z.intersection(
    WallItemBaseSchema.extend({
      type: z.literal('album'),
      title: z.string(),
      content: z.array(
        WallItemBaseSchema.extend({
          versions: z.array(ImageSchema),
        })
      ),
    }),
    Privacy
  );

  const RawVideoSchema = z.intersection(
    WallItemBaseSchema.extend({
      type: z.literal('video'),
      caption: z.string(),
      duration: IntegerSchema,
      previews: z.array(ImageSchema),
    }),
    Privacy
  );

  // Main RawWallItem schema using union instead of discriminated union
  const RawWallItemSchema = z.union([RawPhotoSchema, RawAlbumSchema, RawVideoSchema, RawNoteSchema]);
  const RawWallData = z.array(RawWallItemSchema);

  return RawWallData;
}

const schema = makeSchema();

export function schemaCreation(iterations: number) {
  for (let i = 0; i < iterations; i++) makeSchema();
}

export function validation(iterations: number) {
  for (let i = 0; i < iterations; i++) schema.safeParse(testData);
}
