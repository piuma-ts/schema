import { object, string, number, boolean, literal, variant, intersect, union, array, safeParse } from 'valibot';
import { testData } from './example-data';

function makeSchema() {
  const ImageSchema = object({
    key: string(),
    uri: string(),
    width: number(),
    height: number(),
    isBlurred: boolean(),
    mainColor: string(),
  });

  const WallItemBaseSchema = object({
    id: string(),
    createdAt: string(),
  });

  const PrivacySchema = variant('privacy', [
    object({
      privacy: literal('public'),
    }),
    object({
      privacy: literal('exclusive'),
      isUnlocked: boolean(),
      price: number(),
    }),
  ]);

  const RawPhotoSchema = intersect([
    PrivacySchema,
    object({
      ...WallItemBaseSchema.entries,
      type: literal('photo'),
      albumId: string(),
      versions: array(ImageSchema),
    }),
  ]);

  const RawNoteSchema = intersect([
    PrivacySchema,
    object({
      ...WallItemBaseSchema.entries,
      type: literal('note'),
      content: string(),
    }),
  ]);

  const RawAlbumSchema = intersect([
    PrivacySchema,
    object({
      ...WallItemBaseSchema.entries,
      type: literal('album'),
      title: string(),
      content: array(
        object({
          id: string(),
          createdAt: string(),
          versions: array(ImageSchema),
        })
      ),
    }),
  ]);

  const RawVideoSchema = intersect([
    PrivacySchema,
    object({
      ...WallItemBaseSchema.entries,
      type: literal('video'),
      caption: string(),
      duration: number(),
      previews: array(ImageSchema),
    }),
  ]);

  const RawWallItemSchema = union([RawPhotoSchema, RawAlbumSchema, RawVideoSchema, RawNoteSchema]);
  const RawWallData = array(RawWallItemSchema);

  return RawWallData;
}

export const schema = makeSchema();

export function schemaCreation(iterations: number) {
  for (let i = 0; i < iterations; i++) makeSchema();
}

export function validation(iterations: number) {
  for (let i = 0; i < iterations; i++) safeParse(schema, testData);
}
