import { roundEmoji, shareText } from './share'

describe('roundEmoji', () => {
  it.each([
    [3, '🟩'],
    [2, '🟧'],
    [1, '🟧'],
    [0, '🟥'],
  ])('%i points → %s', (points, emoji) => {
    expect(roundEmoji({ points })).toBe(emoji)
  })
})

describe('shareText', () => {
  it('shows the playlist, score and one square per song, with no answers', () => {
    const text = shareText({
      rounds: [3, 2, 0, 1].map((points) => ({ points })),
      score: 6,
      maxScore: 12,
      playlistTitle: '80s Hits',
      url: 'https://name-that-tune-2.vercel.app',
    })
    expect(text).toBe(
      ['🎵 TuneIn · 80s Hits: 6/12', '🟩🟧🟥🟧', 'Can you beat me? https://name-that-tune-2.vercel.app'].join('\n'),
    )
  })
})
