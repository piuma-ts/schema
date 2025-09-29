// Test data for benchmarking
export const testData = [
  {
    id: 'photo-1',
    createdAt: '2023-01-01T00:00:00Z',
    type: 'photo' as const,
    privacy: 'public' as const,
    albumId: 'album-1',
    versions: [
      {
        key: 'img-1',
        uri: 'https://example.com/img1.jpg',
        width: 1920,
        height: 1080,
        isBlurred: false,
        mainColor: '#ff0000',
      },
    ],
  },
  {
    id: 'note-1',
    createdAt: '2023-01-02T00:00:00Z',
    type: 'note' as const,
    privacy: 'exclusive' as const,
    isUnlocked: true,
    price: 100,
    content: 'This is a test note',
  },
  {
    id: 'album-1',
    createdAt: '2023-01-03T00:00:00Z',
    type: 'album' as const,
    privacy: 'public' as const,
    title: 'Test Album',
    content: [
      {
        id: 'img-1',
        createdAt: '2023-01-03T01:00:00Z',
        versions: [
          {
            key: 'img-1',
            uri: 'https://example.com/img1.jpg',
            width: 1920,
            height: 1080,
            isBlurred: false,
            mainColor: '#ff0000',
          },
        ],
      },
    ],
  },
  {
    id: 'video-1',
    createdAt: '2023-01-04T00:00:00Z',
    type: 'video' as const,
    privacy: 'exclusive' as const,
    isUnlocked: false,
    price: 200,
    caption: 'Test video',
    duration: 120,
    previews: [
      {
        key: 'preview-1',
        uri: 'https://example.com/preview1.jpg',
        width: 1280,
        height: 720,
        isBlurred: true,
        mainColor: '#00ff00',
      },
    ],
  },
];
