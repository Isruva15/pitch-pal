// Daily reading: short passages from public-domain literature, poetry and philosophy.
// Translations are older public-domain ones, named in each entry.
(function () {
  const L = "literature", P = "poetry", F = "philosophy";
  const PASSAGES = [
    // literature
    { kind: L, author: "Charles Dickens", work: "A Tale of Two Cities (1859)", text: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair." },
    { kind: L, author: "Jane Austen", work: "Pride and Prejudice (1813)", text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife." },
    { kind: L, author: "Herman Melville", work: "Moby-Dick (1851)", text: "Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world." },
    { kind: L, author: "Leo Tolstoy", work: "Anna Karenina (1878), tr. Constance Garnett", text: "Happy families are all alike; every unhappy family is unhappy in its own way." },
    { kind: L, author: "F. Scott Fitzgerald", work: "The Great Gatsby (1925)", text: "So we beat on, boats against the current, borne back ceaselessly into the past." },
    { kind: L, author: "Charlotte Brontë", work: "Jane Eyre (1847)", text: "I am no bird; and no net ensnares me: I am a free human being with an independent will, which I now exert to leave you." },
    { kind: L, author: "Charles Dickens", work: "Great Expectations (1861)", text: "I have been bent and broken, but—I hope—into a better shape." },
    { kind: L, author: "Mary Shelley", work: "Frankenstein (1818)", text: "Beware; for I am fearless, and therefore powerful." },
    { kind: L, author: "Lewis Carroll", work: "Through the Looking-Glass (1871)", text: "Why, sometimes I've believed as many as six impossible things before breakfast." },
    { kind: L, author: "Lewis Carroll", work: "Alice's Adventures in Wonderland (1865)", text: "“Would you tell me, please, which way I ought to go from here?” “That depends a good deal on where you want to get to,” said the Cat." },
    { kind: L, author: "L. M. Montgomery", work: "Anne of Green Gables (1908)", text: "Marilla, isn't it nice to think that tomorrow is a new day with no mistakes in it yet?" },
    { kind: L, author: "Charles Dickens", work: "A Christmas Carol (1843)", text: "I will honour Christmas in my heart, and try to keep it all the year." },
    { kind: L, author: "Louisa May Alcott", work: "Little Women (1868)", text: "I'm not afraid of storms, for I'm learning how to sail my ship." },
    { kind: L, author: "Henry David Thoreau", work: "Walden (1854)", text: "I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived." },
    { kind: L, author: "Kenneth Grahame", work: "The Wind in the Willows (1908)", text: "Believe me, my young friend, there is nothing—absolutely nothing—half so much worth doing as simply messing about in boats." },
    { kind: L, author: "Jane Austen", work: "Persuasion (1817)", text: "You pierce my soul. I am half agony, half hope." },
    { kind: L, author: "Arthur Conan Doyle", work: "A Scandal in Bohemia (1891)", text: "You see, but you do not observe." },

    // poetry
    { kind: P, author: "Robert Frost", work: "The Road Not Taken (1916)", text: "Two roads diverged in a wood, and I—\nI took the one less traveled by,\nAnd that has made all the difference." },
    { kind: P, author: "Robert Frost", work: "Stopping by Woods on a Snowy Evening (1923)", text: "The woods are lovely, dark and deep,\nBut I have promises to keep,\nAnd miles to go before I sleep,\nAnd miles to go before I sleep." },
    { kind: P, author: "Emily Dickinson", work: "“Hope” is the thing with feathers", text: "“Hope” is the thing with feathers -\nThat perches in the soul -\nAnd sings the tune without the words -\nAnd never stops - at all -" },
    { kind: P, author: "Walt Whitman", work: "Song of Myself (1855)", text: "Do I contradict myself?\nVery well then I contradict myself,\n(I am large, I contain multitudes.)" },
    { kind: P, author: "John Keats", work: "Endymion (1818)", text: "A thing of beauty is a joy for ever:\nIts loveliness increases; it will never\nPass into nothingness" },
    { kind: P, author: "William Shakespeare", work: "Sonnet 18 (1609)", text: "Shall I compare thee to a summer's day?\nThou art more lovely and more temperate:" },
    { kind: P, author: "William Blake", work: "Auguries of Innocence", text: "To see a World in a Grain of Sand\nAnd a Heaven in a Wild Flower,\nHold Infinity in the palm of your hand\nAnd Eternity in an hour." },
    { kind: P, author: "William Wordsworth", work: "I Wandered Lonely as a Cloud (1807)", text: "I wandered lonely as a cloud\nThat floats on high o'er vales and hills,\nWhen all at once I saw a crowd,\nA host, of golden daffodils;" },
    { kind: P, author: "Alfred, Lord Tennyson", work: "Ulysses (1842)", text: "One equal temper of heroic hearts,\nMade weak by time and fate, but strong in will\nTo strive, to seek, to find, and not to yield." },
    { kind: P, author: "William Ernest Henley", work: "Invictus (1875)", text: "I am the master of my fate,\nI am the captain of my soul." },
    { kind: P, author: "Rudyard Kipling", work: "If— (1910)", text: "If you can fill the unforgiving minute\nWith sixty seconds' worth of distance run,\nYours is the Earth and everything that's in it,\nAnd—which is more—you'll be a Man, my son!" },
    { kind: P, author: "Percy Bysshe Shelley", work: "Ozymandias (1818)", text: "My name is Ozymandias, King of Kings;\nLook on my Works, ye Mighty, and despair!" },
    { kind: P, author: "Lord Byron", work: "She Walks in Beauty (1815)", text: "She walks in beauty, like the night\nOf cloudless climes and starry skies;" },
    { kind: P, author: "Henry Wadsworth Longfellow", work: "A Psalm of Life (1838)", text: "Lives of great men all remind us\nWe can make our lives sublime,\nAnd, departing, leave behind us\nFootprints on the sands of time;" },
    { kind: P, author: "Emily Brontë", work: "No Coward Soul Is Mine (1846)", text: "No coward soul is mine,\nNo trembler in the world's storm-troubled sphere:" },
    { kind: P, author: "W. B. Yeats", work: "The Lake Isle of Innisfree (1890)", text: "I will arise and go now, and go to Innisfree," },
    { kind: P, author: "Langston Hughes", work: "Dreams (1923)", text: "Hold fast to dreams\nFor if dreams die\nLife is a broken-winged bird\nThat cannot fly." },

    // philosophy
    { kind: F, author: "Marcus Aurelius", work: "Meditations X.16, tr. George Long", text: "No longer talk at all about the kind of man that a good man ought to be, but be such." },
    { kind: F, author: "Marcus Aurelius", work: "Meditations V.16, tr. George Long", text: "Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts." },
    { kind: F, author: "Marcus Aurelius", work: "Meditations II.5, tr. George Long", text: "…thou wilt give thyself relief, if thou doest every act of thy life as if it were the last…" },
    { kind: F, author: "Epictetus", work: "Enchiridion 5, tr. George Long", text: "Men are disturbed not by the things which happen, but by the opinions about the things." },
    { kind: F, author: "Epictetus", work: "Enchiridion 1, tr. George Long", text: "Of things some are in our power, and others are not." },
    { kind: F, author: "Seneca", work: "Moral Letters to Lucilius I, tr. Richard M. Gummere", text: "Hold every hour in your grasp. Lay hold of to-day's task, and you will not need to depend so much upon to-morrow's." },
    { kind: F, author: "Plato", work: "Apology, tr. Benjamin Jowett", text: "…the unexamined life is not worth living…" },
    { kind: F, author: "Aristotle", work: "Nicomachean Ethics I.7, tr. W. D. Ross", text: "For one swallow does not make a summer, nor does one day; and so too one day, or a short time, does not make a man blessed and happy." },
    { kind: F, author: "Aristotle", work: "Nicomachean Ethics II.1, tr. W. D. Ross", text: "…we become just by doing just acts, temperate by doing temperate acts, brave by doing brave acts." },
    { kind: F, author: "Lao Tzu", work: "Tao Te Ching 64, tr. James Legge", text: "The journey of a thousand li commenced with a single step." },
    { kind: F, author: "Confucius", work: "Analects I.1, tr. James Legge", text: "Is it not pleasant to learn with a constant perseverance and application?" },
    { kind: F, author: "Ralph Waldo Emerson", work: "Self-Reliance (1841)", text: "Trust thyself: every heart vibrates to that iron string." },
    { kind: F, author: "Blaise Pascal", work: "Pensées, tr. W. F. Trotter", text: "The heart has its reasons, which reason does not know." },
    { kind: F, author: "Henry David Thoreau", work: "Walden (1854)", text: "The mass of men lead lives of quiet desperation." },
    { kind: F, author: "Plato", work: "Cratylus, tr. Benjamin Jowett", text: "Heracleitus is supposed to say that all things are in motion and nothing at rest; he compares them to the stream of a river, and says that you cannot go into the same water twice." },
    { kind: F, author: "Baruch Spinoza", work: "Ethics (1677), tr. R. H. M. Elwes", text: "But all things excellent are as difficult as they are rare." },
  ];
  const KINDS = [[L, "Literature"], [P, "Poetry"], [F, "Philosophy"]];
  const byKind = k => PASSAGES.filter(p => p.kind === k);
  // Today's pick for a kind: steps through the list one passage per day.
  function todayIndex(kind, date) {
    const day = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 864e5);
    const n = byKind(kind).length, salt = { literature: 0, poetry: 5, philosophy: 11 }[kind];
    return ((day * 7 + salt) % n + n) % n;
  }
  window.Reading = { PASSAGES, KINDS, byKind, todayIndex };
})();
