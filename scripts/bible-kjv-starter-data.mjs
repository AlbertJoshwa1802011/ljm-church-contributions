// Curated King James Version starter set for the Bible verse data dictionary
// (functions/api/bible.js). KJV is public domain, so this can be embedded
// and redistributed freely.
//
// This is NOT the complete Bible (that's ~31,100 verses) — it's a "greatest
// hits" set of well-known, high-confidence verses spanning all 66 books, so
// the book/chapter/verse picker in the admin console is genuinely useful
// (browse, search) from day one. See BIBLE_VERSES.md for how a church admin
// can bulk-import the complete text (KJV or Tamil O.V.) via
// POST /api/bible {action:"import"} whenever they're ready to.
//
// Format: [book, chapter, verse, text]. Books are listed in canonical order;
// functions/api/bible.js uses this same order list to sort "books" results.

export const BOOK_ORDER = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
  "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
  "Jude", "Revelation"
];

export const KJV_VERSES = [
  ["Genesis", 1, 1, "In the beginning God created the heaven and the earth."],
  ["Genesis", 1, 27, "So God created man in his own image, in the image of God created he him; male and female created he them."],
  ["Genesis", 2, 24, "Therefore shall a man leave his father and his mother, and shall cleave unto his wife: and they shall be one flesh."],
  ["Genesis", 12, 2, "And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing:"],
  ["Genesis", 50, 20, "But as for you, ye thought evil against me; but God meant it unto good, to bring to pass, as it is this day, to save much people alive."],

  ["Exodus", 3, 14, "And God said unto Moses, I AM THAT I AM: and he said, Thus shalt thou say unto the children of Israel, I AM hath sent me unto you."],
  ["Exodus", 14, 14, "The LORD shall fight for you, and ye shall hold your peace."],
  ["Exodus", 20, 3, "Thou shalt have no other gods before me."],
  ["Exodus", 20, 12, "Honour thy father and thy mother: that thy days may be long upon the land which the LORD thy God giveth thee."],

  ["Leviticus", 19, 18, "Thou shalt not avenge, nor bear any grudge against the children of thy people, but thou shalt love thy neighbour as thyself: I am the LORD."],
  ["Leviticus", 20, 26, "And ye shall be holy unto me: for I the LORD am holy, and have severed you from other people, that ye should be mine."],

  ["Numbers", 6, 24, "The LORD bless thee, and keep thee:"],
  ["Numbers", 6, 25, "The LORD make his face shine upon thee, and be gracious unto thee:"],
  ["Numbers", 6, 26, "The LORD lift up his countenance upon thee, and give thee peace."],
  ["Numbers", 23, 19, "God is not a man, that he should lie; neither the son of man, that he should repent: hath he said, and shall he not do it? or hath he spoken, and shall he not make it good?"],

  ["Deuteronomy", 6, 5, "And thou shalt love the LORD thy God with all thine heart, and with all thy soul, and with all thy might."],
  ["Deuteronomy", 31, 6, "Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee."],
  ["Deuteronomy", 31, 8, "And the LORD, he it is that doth go before thee; he will be with thee, he will not fail thee, neither forsake thee: fear not, neither be dismayed."],

  ["Joshua", 1, 9, "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest."],
  ["Joshua", 24, 15, "And if it seem evil unto you to serve the LORD, choose you this day whom ye will serve; whether the gods which your fathers served that were on the other side of the flood, or the gods of the Amorites, in whose land ye dwell: but as for me and my house, we will serve the LORD."],

  ["Judges", 6, 12, "And the angel of the LORD appeared unto him, and said unto him, The LORD is with thee, thou mighty man of valour."],

  ["Ruth", 1, 16, "And Ruth said, Intreat me not to leave thee, or to return from following after thee: for whither thou goest, I will go; and where thou lodgest, I will lodge: thy people shall be my people, and thy God my God:"],

  ["1 Samuel", 16, 7, "But the LORD said unto Samuel, Look not on his countenance, or on the height of his stature; because I have refused him: for the LORD seeth not as man seeth; for man looketh on the outward appearance, but the LORD looketh on the heart."],
  ["1 Samuel", 17, 47, "And all this assembly shall know that the LORD saveth not with sword and spear: for the battle is the LORD'S, and he will give you into our hands."],

  ["2 Samuel", 22, 31, "As for God, his way is perfect; the word of the LORD is tried: he is a buckler to all them that trust in him."],

  ["1 Kings", 8, 57, "The LORD our God be with us, as he was with our fathers: let him not leave us, nor forsake us:"],

  ["2 Kings", 6, 16, "And he answered, Fear not: for they that be with us are more than they that be with them."],

  ["1 Chronicles", 4, 10, "And Jabez called on the God of Israel, saying, Oh that thou wouldest bless me indeed, and enlarge my coast, and that thine hand might be with me, and that thou wouldest keep me from evil, that it may not grieve me! And God granted him that which he requested."],
  ["1 Chronicles", 16, 34, "O give thanks unto the LORD; for he is good; for his mercy endureth for ever."],

  ["2 Chronicles", 7, 14, "If my people, which are called by my name, shall humble themselves, and pray, and seek my face, and turn from their wicked ways; then will I hear from heaven, and will forgive their sin, and will heal their land."],

  ["Ezra", 7, 10, "For Ezra had prepared his heart to seek the law of the LORD, and to do it, and to teach in Israel statutes and judgments."],

  ["Nehemiah", 8, 10, "Then he said unto them, Go your way, eat the fat, and drink the sweet, and send portions unto them for whom nothing is prepared: for this day is holy unto our LORD: neither be ye sorry; for the joy of the LORD is your strength."],

  ["Esther", 4, 14, "For if thou altogether holdest thy peace at this time, then shall there enlargement and deliverance arise to the Jews from another place; but thou and thy father's house shall be destroyed: and who knoweth whether thou art come to the kingdom for such a time as this?"],

  ["Job", 1, 21, "And said, Naked came I out of my mother's womb, and naked shall I return thither: the LORD gave, and the LORD hath taken away; blessed be the name of the LORD."],
  ["Job", 19, 25, "For I know that my redeemer liveth, and that he shall stand at the latter day upon the earth:"],
  ["Job", 42, 2, "I know that thou canst do every thing, and that no thought can be withholden from thee."],

  ["Psalms", 23, 1, "The LORD is my shepherd; I shall not want."],
  ["Psalms", 23, 4, "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me."],
  ["Psalms", 27, 1, "The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?"],
  ["Psalms", 34, 8, "O taste and see that the LORD is good: blessed is the man that trusteth in him."],
  ["Psalms", 37, 4, "Delight thyself also in the LORD: and he shall give thee the desires of thine heart."],
  ["Psalms", 46, 1, "God is our refuge and strength, a very present help in trouble."],
  ["Psalms", 46, 10, "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth."],
  ["Psalms", 51, 10, "Create in me a clean heart, O God; and renew a right spirit within me."],
  ["Psalms", 91, 1, "He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty."],
  ["Psalms", 100, 5, "For the LORD is good; his mercy is everlasting; and his truth endureth to all generations."],
  ["Psalms", 103, 1, "Bless the LORD, O my soul: and all that is within me, bless his holy name."],
  ["Psalms", 119, 105, "Thy word is a lamp unto my feet, and a light unto my path."],
  ["Psalms", 121, 1, "I will lift up mine eyes unto the hills, from whence cometh my help."],
  ["Psalms", 121, 2, "My help cometh from the LORD, which made heaven and earth."],
  ["Psalms", 127, 1, "Except the LORD build the house, they labour in vain that build it: except the LORD keep the city, the watchman waketh but in vain."],
  ["Psalms", 139, 14, "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well."],
  ["Psalms", 150, 6, "Let every thing that hath breath praise the LORD. Praise ye the LORD."],

  ["Proverbs", 3, 5, "Trust in the LORD with all thine heart; and lean not unto thine own understanding."],
  ["Proverbs", 3, 6, "In all thy ways acknowledge him, and he shall direct thy paths."],
  ["Proverbs", 16, 3, "Commit thy works unto the LORD, and thy thoughts shall be established."],
  ["Proverbs", 17, 17, "A friend loveth at all times, and a brother is born for adversity."],
  ["Proverbs", 18, 10, "The name of the LORD is a strong tower: the righteous runneth into it, and is safe."],
  ["Proverbs", 22, 6, "Train up a child in the way he should go: and when he is old, he will not depart from it."],
  ["Proverbs", 27, 17, "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend."],
  ["Proverbs", 31, 25, "Strength and honour are her clothing; and she shall rejoice in time to come."],

  ["Ecclesiastes", 3, 1, "To every thing there is a season, and a time to every purpose under the heaven:"],
  ["Ecclesiastes", 3, 11, "He hath made every thing beautiful in his time: also he hath set the world in their heart, so that no man can find out the work that God maketh from the beginning to the end."],

  ["Song of Solomon", 2, 4, "He brought me to the banqueting house, and his banner over me was love."],

  ["Isaiah", 9, 6, "For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace."],
  ["Isaiah", 40, 31, "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint."],
  ["Isaiah", 41, 10, "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness."],
  ["Isaiah", 53, 5, "But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed."],
  ["Isaiah", 55, 8, "For my thoughts are not your thoughts, neither are your ways my ways, saith the LORD."],
  ["Isaiah", 64, 8, "But now, O LORD, thou art our father; we are the clay, and thou our potter; and we all are the work of thy hand."],

  ["Jeremiah", 17, 7, "Blessed is the man that trusteth in the LORD, and whose hope the LORD is."],
  ["Jeremiah", 29, 11, "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end."],
  ["Jeremiah", 33, 3, "Call unto me, and I will answer thee, and shew thee great and mighty things, which thou knowest not."],

  ["Lamentations", 3, 22, "It is of the LORD'S mercies that we are not consumed, because his compassions fail not."],
  ["Lamentations", 3, 23, "They are new every morning: great is thy faithfulness."],

  ["Ezekiel", 36, 26, "A new heart also will I give you, and a new spirit will I put within you: and I will take away the stony heart out of your flesh, and I will give you an heart of flesh."],

  ["Daniel", 3, 17, "If it be so, our God whom we serve is able to deliver us from the burning fiery furnace, and he will deliver us out of thine hand, O king."],
  ["Daniel", 3, 18, "But if not, be it known unto thee, O king, that we will not serve thy gods, nor worship the golden image which thou hast set up."],
  ["Daniel", 6, 22, "My God hath sent his angel, and hath shut the lions' mouths, that they have not hurt me: forasmuch as before him innocency was found in me."],

  ["Hosea", 6, 6, "For I desired mercy, and not sacrifice; and the knowledge of God more than burnt offerings."],

  ["Joel", 2, 25, "And I will restore to you the years that the locust hath eaten, the cankerworm, and the caterpiller, and the palmerworm, my great army which I sent among you."],

  ["Amos", 5, 24, "But let judgment run down as waters, and righteousness as a mighty stream."],

  ["Obadiah", 1, 15, "For the day of the LORD is near upon all the heathen: as thou hast done, it shall be done unto thee: thy reward shall return upon thine own head."],

  ["Jonah", 2, 9, "But I will sacrifice unto thee with the voice of thanksgiving; I will pay that that I have vowed. Salvation is of the LORD."],

  ["Micah", 6, 8, "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?"],

  ["Nahum", 1, 7, "The LORD is good, a strong hold in the day of trouble; and he knoweth them that trust in him."],

  ["Habakkuk", 2, 4, "Behold, his soul which is lifted up is not upright in him: but the just shall live by his faith."],
  ["Habakkuk", 3, 19, "The LORD God is my strength, and he will make my feet like hinds' feet, and he will make me to walk upon mine high places."],

  ["Zephaniah", 3, 17, "The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing."],

  ["Haggai", 2, 9, "The glory of this latter house shall be greater than of the former, saith the LORD of hosts: and in this place will I give peace, saith the LORD of hosts."],

  ["Zechariah", 4, 6, "Then he answered and spake unto me, saying, This is the word of the LORD unto Zerubbabel, saying, Not by might, nor by power, but by my spirit, saith the LORD of hosts."],

  ["Malachi", 3, 6, "For I am the LORD, I change not; therefore ye sons of Jacob are not consumed."],
  ["Malachi", 3, 10, "Bring ye all the tithes into the storehouse, that there may be meat in mine house, and prove me now herewith, saith the LORD of hosts, if I will not open you the windows of heaven, and pour you out a blessing, that there shall not be room enough to receive it."],

  ["Matthew", 5, 16, "Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven."],
  ["Matthew", 6, 21, "For where your treasure is, there will your heart be also."],
  ["Matthew", 6, 33, "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you."],
  ["Matthew", 7, 7, "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:"],
  ["Matthew", 11, 28, "Come unto me, all ye that labour and are heavy laden, and I will give you rest."],
  ["Matthew", 22, 37, "Jesus said unto him, Thou shalt love the Lord thy God with all thy heart, and with all thy soul, and with all thy mind."],
  ["Matthew", 28, 19, "Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost:"],
  ["Matthew", 28, 20, "Teaching them to observe all things whatsoever I have commanded you: and, lo, I am with you alway, even unto the end of the world. Amen."],

  ["Mark", 10, 27, "And Jesus looking upon them saith, With men it is impossible, but not with God: for with God all things are possible."],
  ["Mark", 11, 24, "Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them."],
  ["Mark", 16, 15, "And he said unto them, Go ye into all the world, and preach the gospel to every creature."],

  ["Luke", 1, 37, "For with God nothing shall be impossible."],
  ["Luke", 2, 11, "For unto you is born this day in the city of David a Saviour, which is Christ the Lord."],
  ["Luke", 6, 38, "Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over, shall men give into your bosom. For with the same measure that ye mete withal it shall be measured to you again."],

  ["John", 1, 1, "In the beginning was the Word, and the Word was with God, and the Word was God."],
  ["John", 3, 16, "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."],
  ["John", 8, 12, "Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life."],
  ["John", 10, 10, "The thief cometh not, but for to steal, and to kill, and to destroy: I am come that they might have life, and that they might have it more abundantly."],
  ["John", 13, 34, "A new commandment I give unto you, That ye love one another; as I have loved you, that ye also love one another."],
  ["John", 14, 6, "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me."],
  ["John", 15, 13, "Greater love hath no man than this, that a man lay down his life for his friends."],
  ["John", 16, 33, "These things I have spoken unto you, that in me ye might have peace. In the world ye shall have tribulation: but be of good cheer; I have overcome the world."],

  ["Acts", 1, 8, "But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me both in Jerusalem, and in all Judaea, and in Samaria, and unto the uttermost part of the earth."],
  ["Acts", 4, 12, "Neither is there salvation in any other: for there is none other name under heaven given among men, whereby we must be saved."],
  ["Acts", 20, 35, "It is more blessed to give than to receive."],

  ["Romans", 3, 23, "For all have sinned, and come short of the glory of God;"],
  ["Romans", 5, 8, "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us."],
  ["Romans", 6, 23, "For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord."],
  ["Romans", 8, 28, "And we know that all things work together for good to them that love God, to them who are the called according to his purpose."],
  ["Romans", 8, 38, "For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,"],
  ["Romans", 8, 39, "Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord."],
  ["Romans", 10, 9, "That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved."],
  ["Romans", 12, 1, "I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service."],
  ["Romans", 12, 2, "And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God."],

  ["1 Corinthians", 10, 13, "There hath no temptation taken you but such as is common to man: but God is faithful, who will not suffer you to be tempted above that ye are able; but will with the temptation also make a way to escape, that ye may be able to bear it."],
  ["1 Corinthians", 13, 4, "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,"],
  ["1 Corinthians", 13, 7, "Beareth all things, believeth all things, hopeth all things, endureth all things."],
  ["1 Corinthians", 13, 13, "And now abideth faith, hope, charity, these three; but the greatest of these is charity."],
  ["1 Corinthians", 16, 14, "Let all your things be done with charity."],

  ["2 Corinthians", 5, 7, "(For we walk by faith, not by sight:)"],
  ["2 Corinthians", 5, 17, "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new."],
  ["2 Corinthians", 9, 6, "But this I say, He which soweth sparingly shall reap also sparingly; and he which soweth bountifully shall reap also bountifully."],
  ["2 Corinthians", 9, 7, "Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver."],
  ["2 Corinthians", 12, 9, "And he said unto me, My grace is sufficient for thee: for my strength is made perfect in weakness. Most gladly therefore will I rather glory in my infirmities, that the power of Christ may rest upon me."],

  ["Galatians", 2, 20, "I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me: and the life which I now live in the flesh I live by the faith of the Son of God, who loved me, and gave himself for me."],
  ["Galatians", 5, 22, "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith,"],
  ["Galatians", 5, 23, "Meekness, temperance: against such there is no law."],
  ["Galatians", 6, 9, "And let us not be weary in well doing: for in due season we shall reap, if we faint not."],

  ["Ephesians", 2, 8, "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:"],
  ["Ephesians", 2, 9, "Not of works, lest any man should boast."],
  ["Ephesians", 3, 20, "Now unto him that is able to do exceeding abundantly above all that we ask or think, according to the power that worketh in us,"],
  ["Ephesians", 4, 32, "And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ's sake hath forgiven you."],
  ["Ephesians", 6, 11, "Put on the whole armour of God, that ye may be able to stand against the wiles of the devil."],

  ["Philippians", 1, 6, "Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ:"],
  ["Philippians", 4, 6, "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God."],
  ["Philippians", 4, 7, "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus."],
  ["Philippians", 4, 13, "I can do all things through Christ which strengtheneth me."],
  ["Philippians", 4, 19, "But my God shall supply all your need according to his riches in glory by Christ Jesus."],

  ["Colossians", 3, 2, "Set your affection on things above, not on things on the earth."],
  ["Colossians", 3, 23, "And whatsoever ye do, do it heartily, as to the Lord, and not unto men;"],

  ["1 Thessalonians", 5, 16, "Rejoice evermore."],
  ["1 Thessalonians", 5, 17, "Pray without ceasing."],
  ["1 Thessalonians", 5, 18, "In every thing give thanks: for this is the will of God in Christ Jesus concerning you."],

  ["2 Thessalonians", 3, 3, "But the Lord is faithful, who shall stablish you, and keep you from evil."],

  ["1 Timothy", 4, 12, "Let no man despise thy youth; but be thou an example of the believers, in word, in conversation, in charity, in spirit, in faith, in purity."],
  ["1 Timothy", 6, 10, "For the love of money is the root of all evil: which while some coveted after, they have erred from the faith, and pierced themselves through with many sorrows."],

  ["2 Timothy", 1, 7, "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind."],
  ["2 Timothy", 3, 16, "All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:"],
  ["2 Timothy", 4, 7, "I have fought a good fight, I have finished my course, I have kept the faith:"],

  ["Titus", 2, 11, "For the grace of God that bringeth salvation hath appeared to all men,"],

  ["Philemon", 1, 7, "For we have great joy and consolation in thy love, because the bowels of the saints are refreshed by thee, brother."],

  ["Hebrews", 4, 16, "Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need."],
  ["Hebrews", 11, 1, "Now faith is the substance of things hoped for, the evidence of things not seen."],
  ["Hebrews", 12, 1, "Wherefore seeing we also are compassed about with so great a cloud of witnesses, let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us,"],
  ["Hebrews", 13, 8, "Jesus Christ the same yesterday, and to day, and for ever."],

  ["James", 1, 2, "My brethren, count it all joy when ye fall into divers temptations;"],
  ["James", 1, 3, "Knowing this, that the trying of your faith worketh patience."],
  ["James", 1, 5, "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him."],
  ["James", 1, 17, "Every good gift and every perfect gift is from above, and cometh down from the Father of lights, with whom is no variableness, neither shadow of turning."],
  ["James", 4, 7, "Submit yourselves therefore to God. Resist the devil, and he will flee from you."],

  ["1 Peter", 2, 9, "But ye are a chosen generation, a royal priesthood, an holy nation, a peculiar people; that ye should shew forth the praises of him who hath called you out of darkness into his marvellous light;"],
  ["1 Peter", 3, 15, "But sanctify the Lord God in your hearts: and be ready always to give an answer to every man that asketh you a reason of the hope that is in you with meekness and fear:"],
  ["1 Peter", 5, 7, "Casting all your care upon him; for he careth for you."],

  ["2 Peter", 1, 3, "According as his divine power hath given unto us all things that pertain unto life and godliness, through the knowledge of him that hath called us to glory and virtue:"],
  ["2 Peter", 3, 9, "The Lord is not slack concerning his promise, as some men count slackness; but is longsuffering to us-ward, not willing that any should perish, but that all should come to repentance."],

  ["1 John", 1, 9, "If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness."],
  ["1 John", 3, 1, "Behold, what manner of love the Father hath bestowed upon us, that we should be called the sons of God: therefore the world knoweth us not, because it knew him not."],
  ["1 John", 4, 8, "He that loveth not knoweth not God; for God is love."],
  ["1 John", 4, 18, "There is no fear in love; but perfect love casteth out fear: because fear hath torment. He that feareth is not made perfect in love."],
  ["1 John", 4, 19, "We love him, because he first loved us."],

  ["2 John", 1, 6, "And this is love, that we walk after his commandments. This is the commandment, That, as ye have heard from the beginning, ye should walk in it."],

  ["3 John", 1, 2, "Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth."],
  ["3 John", 1, 4, "I have no greater joy than to hear that my children walk in truth."],

  ["Jude", 1, 24, "Now unto him that is able to keep you from falling, and to present you faultless before the presence of his glory with exceeding joy,"],
  ["Jude", 1, 25, "To the only wise God our Saviour, be glory and majesty, dominion and power, both now and ever. Amen."],

  ["Revelation", 1, 8, "I am Alpha and Omega, the beginning and the ending, saith the Lord, which is, and which was, and which is to come, the Almighty."],
  ["Revelation", 3, 20, "Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him, and will sup with him, and he with me."],
  ["Revelation", 21, 4, "And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away."],
  ["Revelation", 22, 13, "I am Alpha and Omega, the beginning and the end, the first and the last."]
];
