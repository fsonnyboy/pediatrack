import {
  PrismaClient, UserRole, Gender, BloodType, AppointmentType, AppointmentStatus, ScreeningType,
  MilestoneDomain, CodeSystem, DiagnosisStatus, DiagnosisCertainty,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * Standard childhood immunization schedule (WHO / EPI aligned).
 * recommendedAgeMonths is the age for dose 1; intervalDays is the gap to the next dose.
 */
const VACCINES = [
  { code: 'BCG',    name: 'Bacillus Calmette-Guerin',      totalDoses: 1, recommendedAgeMonths: 0,  intervalDays: null, description: 'Protects against tuberculosis. Given at birth.' },
  { code: 'HEPB',   name: 'Hepatitis B',                   totalDoses: 3, recommendedAgeMonths: 0,  intervalDays: 30,   description: 'Birth dose, then at 6 weeks and 14 weeks.' },
  { code: 'DTAP',   name: 'Diphtheria, Tetanus, Pertussis',totalDoses: 5, recommendedAgeMonths: 2,  intervalDays: 60,   description: 'Primary series at 2, 4, 6 months; boosters later.' },
  { code: 'IPV',    name: 'Inactivated Polio Vaccine',     totalDoses: 4, recommendedAgeMonths: 2,  intervalDays: 60,   description: 'Protects against poliomyelitis.' },
  { code: 'HIB',    name: 'Haemophilus influenzae type b', totalDoses: 4, recommendedAgeMonths: 2,  intervalDays: 60,   description: 'Prevents meningitis and pneumonia.' },
  { code: 'PCV13',  name: 'Pneumococcal Conjugate',        totalDoses: 4, recommendedAgeMonths: 2,  intervalDays: 60,   description: 'Protects against pneumococcal disease.' },
  { code: 'ROTA',   name: 'Rotavirus',                     totalDoses: 3, recommendedAgeMonths: 2,  intervalDays: 60,   description: 'Oral vaccine against severe diarrhea.' },
  { code: 'MMR',    name: 'Measles, Mumps, Rubella',       totalDoses: 2, recommendedAgeMonths: 12, intervalDays: 1095, description: 'First dose at 12 months, second at 4-6 years.' },
  { code: 'VAR',    name: 'Varicella (Chickenpox)',        totalDoses: 2, recommendedAgeMonths: 12, intervalDays: 1095, description: 'Protects against chickenpox.' },
  { code: 'HEPA',   name: 'Hepatitis A',                   totalDoses: 2, recommendedAgeMonths: 12, intervalDays: 180,  description: 'Two doses six months apart.' },
  { code: 'FLU',    name: 'Influenza (Annual)',            totalDoses: 1, recommendedAgeMonths: 6,  intervalDays: 365,  description: 'Given annually from 6 months of age.' },
  { code: 'TYPH',   name: 'Typhoid',                       totalDoses: 1, recommendedAgeMonths: 24, intervalDays: 1095, description: 'Recommended in endemic areas.' },
];

/**
 * Free-to-use developmental screening instruments only. ASQ-3 and PEDS are
 * licensed and are deliberately excluded until a licensing agreement is in
 * place — see the screening implementation plan.
 */
const SCREENING_INSTRUMENTS = [
  {
    code: 'MCHAT_R_F',
    name: 'M-CHAT-R/F',
    type: ScreeningType.AUTISM,
    minAgeMonths: 16,
    maxAgeMonths: 30,
    cutoffNote:
      '0–2 low risk (pass) · 3–7 medium risk (administer follow-up interview, refer if still ≥2) · 8–20 high risk (refer directly)',
  },
  {
    code: 'SWYC',
    name: 'Survey of Wellbeing of Young Children',
    type: ScreeningType.GENERAL,
    minAgeMonths: 1,
    maxAgeMonths: 65,
    cutoffNote:
      'Age-banded milestone cutoffs per SWYC form; below cutoff on any domain = monitor/refer per clinical judgement',
  },
];

/**
 * The twelve CDC/AAP checklist ages, 2 months through 5 years.
 * See MILESTONE-DATA-SOURCE.md for provenance and what to verify before
 * relying on this clinically — the same discipline GROWTH-DATA-WARNING.md
 * asks for on the WHO growth tables, applied before this data ever ships
 * rather than after.
 */
const MILESTONE_CHECKLIST_AGES = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60] as const;

const MILESTONE_CHECKLIST_DATA: { ageMonths: number; domain: MilestoneDomain; items: string[] }[] = [
  // ── 2 months ──────────────────────────────────────────
  { ageMonths: 2, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Calms down when spoken to or picked up',
    'Looks at your face',
    'Seems happy to see you when you walk up to them',
    'Smiles when you talk to or smile at them',
  ] },
  { ageMonths: 2, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Makes sounds other than crying',
    'Reacts to loud sounds',
  ] },
  { ageMonths: 2, domain: MilestoneDomain.COGNITIVE, items: [
    'Watches you as you move',
    'Looks at a toy for several seconds',
  ] },
  { ageMonths: 2, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Holds head up when on tummy',
    'Moves both arms and both legs',
    'Opens hands briefly',
  ] },

  // ── 4 months ──────────────────────────────────────────
  { ageMonths: 4, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Smiles on his own to get your attention',
    'Chuckles (not yet a full laugh) when you try to make her laugh',
    'Looks at you, moves, or makes sounds to get or keep your attention',
  ] },
  { ageMonths: 4, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Makes sounds like "oooo", "aahh" (cooing)',
    'Makes sounds back when you talk to him',
    'Turns head towards the sound of your voice',
  ] },
  { ageMonths: 4, domain: MilestoneDomain.COGNITIVE, items: [
    'Opens his mouth when he sees a bottle',
    'Looks at her hands with interest',
  ] },
  { ageMonths: 4, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Holds head steady without support while being held',
    'Holds a toy when it is put into his hand',
    'Uses his arm to swing at toys',
    'Brings their hands to their mouth',
    'Pushes up onto her elbows/forearms when on tummy',
  ] },

  // ── 6 months ──────────────────────────────────────────
  { ageMonths: 6, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Knows familiar people',
    'Likes to look at himself in a mirror',
    'Laughs',
  ] },
  { ageMonths: 6, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Takes turns making sounds with you',
    'Blows "raspberries" (sticks tongue out and blows)',
    'Makes squealing noises',
  ] },
  { ageMonths: 6, domain: MilestoneDomain.COGNITIVE, items: [
    'Puts things in her mouth to explore them',
    'Reaches to grab a toy he wants',
    "Closes lips to show she doesn't want more food",
  ] },
  { ageMonths: 6, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Rolls from tummy to back',
    'Pushes up with straight arms when on tummy',
    'Leans on hands to support himself when sitting',
  ] },

  // ── 9 months ──────────────────────────────────────────
  { ageMonths: 9, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Is shy, clingy, or fearful around strangers',
    'Shows several facial expressions, like happy, sad, angry, and surprised',
    'Looks when you call her name',
    'Reacts when you leave (looks, reaches for you, or cries)',
    'Smiles or laughs when you play peek-a-boo',
  ] },
  { ageMonths: 9, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Makes different sounds like "mamamama" and "babababa"',
    'Lifts arms up to be picked up',
  ] },
  { ageMonths: 9, domain: MilestoneDomain.COGNITIVE, items: [
    'Looks for objects when dropped out of sight (like his spoon or toy)',
    'Bangs two things together',
  ] },
  { ageMonths: 9, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Gets to a sitting position by herself',
    'Moves things from one hand to her other hand',
    'Uses fingers to "rake" food towards himself',
  ] },

  // ── 12 months ─────────────────────────────────────────
  { ageMonths: 12, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Plays games such as "peek-a-boo" and "pat-a-cake"',
  ] },
  { ageMonths: 12, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Waves "bye-bye"',
    'Calls a parent "mama" or "dada" or another special name',
    'Understands "no" (pauses briefly or stops when you say it)',
  ] },
  { ageMonths: 12, domain: MilestoneDomain.COGNITIVE, items: [
    'Puts things in a container, like a block in a cup',
    'Looks for things he sees you hide, like a toy under a blanket',
  ] },
  { ageMonths: 12, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Pulls to stand',
    'Walks, holding on to furniture',
    'Drinks from a cup without a lid, as you hold it',
    'Picks things up between thumb and pointer finger, like small bits of food',
  ] },

  // ── 15 months (added 2022) ───────────────────────────────
  { ageMonths: 15, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Shows excitement by clapping',
    'Shows affection',
    'Copies other children while playing, like taking toys out of a container when another child does',
  ] },
  { ageMonths: 15, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Tries to say one or two words besides "mama" or "dada," like "ba" for ball or "da" for dog',
    'Follows directions given with both a gesture and words',
    'Points to ask for something or to get help',
  ] },
  { ageMonths: 15, domain: MilestoneDomain.COGNITIVE, items: [
    'Tries to use things the right way, like a phone, cup, or book',
    'Stacks at least two small objects, like blocks',
  ] },
  { ageMonths: 15, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Takes a few steps on his own',
    'Uses fingers to feed herself some food',
  ] },

  // ── 18 months ─────────────────────────────────────────
  { ageMonths: 18, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Moves away from you, but looks to make sure you are close by',
    'Points to show you something interesting',
    'Puts hands out for you to wash them',
    'Looks at a few pages in a book with you',
    'Helps you dress him by pushing arm through sleeve or lifting up foot',
  ] },
  { ageMonths: 18, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Tries to say three or more words besides "mama" or "dada"',
    'Follows one-step directions without any gestures, like giving you the toy when you say "give it to me"',
  ] },
  { ageMonths: 18, domain: MilestoneDomain.COGNITIVE, items: [
    'Copies you doing chores, like sweeping with a broom',
    'Plays with toys in a simple way, like pushing a toy car',
  ] },
  { ageMonths: 18, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Walks without holding on to anyone or anything',
    'Scribbles',
    'Drinks from a cup without a lid and may spill sometimes',
    "Feeds herself with her fingers",
    'Tries to eat with a spoon',
    'Climbs on and off a couch or chair without help',
  ] },

  // ── 24 months ─────────────────────────────────────────
  { ageMonths: 24, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Notices when others are hurt or upset, like pausing or looking sad when someone is crying',
    'Looks at your face to see how to react in a new situation',
  ] },
  { ageMonths: 24, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Points to things or pictures when you ask, like "Where is the bear?"',
    'Says at least two words together, like "more milk"',
    'Points to at least two body parts when you ask him to show you',
    'Uses more gestures than just waving and pointing, like blowing a kiss or nodding yes',
  ] },
  { ageMonths: 24, domain: MilestoneDomain.COGNITIVE, items: [
    'Holds something in one hand while using the other hand; for example, holding a container and taking the lid off',
    'Tries to use switches, knobs, or buttons on a toy',
    'Plays with more than one toy at the same time, like putting toy food on a toy plate',
  ] },
  { ageMonths: 24, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Kicks a ball',
    'Runs',
    'Walks (not climbs) up a few stairs with or without help',
    'Eats with a spoon',
  ] },

  // ── 30 months (added 2022) ───────────────────────────────
  { ageMonths: 30, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Plays next to other children and sometimes plays with them',
    'Shows you what she can do by saying, "look at me!"',
    'Follows simple routines when told, like helping to pick up toys when you say, "it\'s clean-up time."',
  ] },
  { ageMonths: 30, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Says about 50 words',
    'Says two or more words together, with one action word, like "doggie run"',
    'Names things in a book when you point and ask, "what is this?"',
    'Says words like "I", "me", or "we"',
  ] },
  { ageMonths: 30, domain: MilestoneDomain.COGNITIVE, items: [
    'Uses things to pretend, like feeding a block to a doll as if it were food',
    'Shows simple problem-solving skills, like standing on a small stool to reach something',
    'Follows two-step instructions like "Put the toy down and close the door"',
    'Shows he knows at least one color, like pointing to a red crayon when you ask, "Which one is red?"',
  ] },
  { ageMonths: 30, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Uses hands to twist things, like turning doorknobs or unscrewing lids',
    'Takes some clothes off by himself, like loose pants or an open jacket',
    'Jumps off the ground with both feet',
    'Turns book pages, one at a time, when you read to her',
  ] },

  // ── 3 years (36 months) ─────────────────────────────────
  { ageMonths: 36, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Calms down within 10 minutes after you leave her, like at a childcare drop off',
    'Notices other children and joins them to play',
  ] },
  { ageMonths: 36, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Talks with you in conversation using at least two back-and-forth exchanges',
    'Asks "who," "what", "where" and "why" questions, like "Where is mommy/daddy?"',
    'Says what action is happening in a picture or book when asked, like "running," "eating," or "playing"',
    'Says first name when asked',
    'Talks well enough for others to understand most of the time',
  ] },
  { ageMonths: 36, domain: MilestoneDomain.COGNITIVE, items: [
    'Draws a circle, when you show him how',
    'Avoids touching hot objects, like a stove, when you warn her',
  ] },
  { ageMonths: 36, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Strings items together, like large beads or macaroni',
    'Puts on some clothes by himself, like loose pants or a jacket',
    'Uses a fork',
  ] },

  // ── 4 years (48 months) ─────────────────────────────────
  { ageMonths: 48, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Pretends to be something else during play (teacher, superhero, dog)',
    'Asks to go play with children if none are around, like "Can I go play with Alex?"',
    'Comforts others who are hurt or sad, like hugging a crying friend',
    'Avoids danger, like not jumping from tall heights at the playground',
    'Likes to be a "helper"',
    'Changes behavior based on where she is (place of worship, library, playground)',
  ] },
  { ageMonths: 48, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Says sentences with four or more words',
    'Says some words from a song, story, or nursery rhyme',
    'Talks about at least one thing that happened during his day, like "I played soccer."',
    'Answers simple questions like "What is a coat for?" or "What is a crayon for?"',
  ] },
  { ageMonths: 48, domain: MilestoneDomain.COGNITIVE, items: [
    'Names a few colors of items',
    'Tells what comes next in a well-known story',
    'Draws a person with three or more body parts',
  ] },
  { ageMonths: 48, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Catches a large ball most of the time',
    'Serves himself food or pours water, with adult supervision',
    'Unbuttons some buttons',
    'Holds crayon or pencil between fingers and thumb (not a fist)',
  ] },

  // ── 5 years (60 months) ─────────────────────────────────
  { ageMonths: 60, domain: MilestoneDomain.SOCIAL_EMOTIONAL, items: [
    'Follows rules or takes turns when playing games with other children',
    'Sings, dances, or acts for you',
    'Does simple chores at home, like matching socks or clearing the table after dinner',
  ] },
  { ageMonths: 60, domain: MilestoneDomain.LANGUAGE_COMMUNICATION, items: [
    'Tells a story she heard or made up with at least two events, like a cat was stuck in a tree and a firefighter saved it',
    'Answers questions about a book or story after you read or tell it to him',
    'Keeps a conversation going with more than three back-and-forth exchanges',
    'Uses or recognizes simple rhymes (bat-cat, ball-tall)',
  ] },
  { ageMonths: 60, domain: MilestoneDomain.COGNITIVE, items: [
    'Counts to 10',
    'Names some numbers between 1 and 5 when you point to them',
    'Uses words about time, like "yesterday," "tomorrow," "morning," or "night"',
    'Pays attention for 5 to 10 minutes during activities, like story time or arts and crafts (screen time does not count)',
    'Writes some letters in her name',
    'Names some letters when you point to them',
  ] },
  { ageMonths: 60, domain: MilestoneDomain.MOVEMENT_PHYSICAL, items: [
    'Buttons some buttons',
    'Hops on one foot',
  ] },
];

const MILESTONE_DOMAIN_CODE: Record<MilestoneDomain, string> = {
  SOCIAL_EMOTIONAL: 'SOC',
  LANGUAGE_COMMUNICATION: 'LANG',
  COGNITIVE: 'COG',
  MOVEMENT_PHYSICAL: 'MOVE',
};

const MILESTONE_SOURCE = 'CDC Learn the Signs. Act Early.';
const MILESTONE_SOURCE_VERSION = '2022';

const MILESTONE_DEFINITIONS = MILESTONE_CHECKLIST_DATA.flatMap((group, groupIdx) =>
  group.items.map((description, itemIdx) => ({
    code: `CDC2022_${group.ageMonths}M_${MILESTONE_DOMAIN_CODE[group.domain]}_${itemIdx + 1}`,
    checklistAgeMonths: group.ageMonths,
    domain: group.domain,
    description,
    source: MILESTONE_SOURCE,
    sourceVersion: MILESTONE_SOURCE_VERSION,
    sortOrder: groupIdx * 100 + itemIdx,
  })),
);

/**
 * Starter weight-based dose ranges for common pediatric prescriptions, keyed
 * by generic name. Values are the usual maintenance ranges from BNF for
 * Children 2024 — NOT a substitute for a pharmacist review, and deliberately
 * narrow: indication-specific regimens (e.g. high-dose amoxicillin for
 * otitis media) fall outside this range on purpose and should be entered
 * without a matching structured dose rather than widening the reference.
 */
const MEDICINE_DOSE_REFERENCES = [
  {
    genericName: 'Amoxicillin',
    mgPerKgDayMin: 25,
    mgPerKgDayMax: 45,
    maxSingleDoseMg: 1000,
    maxDailyDoseMg: 3000,
    source: 'BNF for Children',
    sourceVersion: '2024',
    notes: 'Standard divided-dose range (e.g. q8h). High-dose regimens (up to 90mg/kg/day) exist for otitis media and are out of scope for this check.',
  },
  {
    genericName: 'Paracetamol',
    mgPerKgDayMin: 40,
    mgPerKgDayMax: 60,
    maxSingleDoseMg: 1000,
    maxDailyDoseMg: 4000,
    source: 'BNF for Children',
    sourceVersion: '2024',
    notes: 'Usual maintenance range at 10-15mg/kg per dose, up to 4 doses/day.',
  },
  {
    genericName: 'Ibuprofen',
    mgPerKgDayMin: 20,
    mgPerKgDayMax: 30,
    maxSingleDoseMg: 400,
    maxDailyDoseMg: 2400,
    source: 'BNF for Children',
    sourceVersion: '2024',
    notes: 'Usual maintenance range at 5-10mg/kg per dose, every 6-8 hours. Not for infants under 3 months.',
  },
];

/**
 * Pediatric short-list of ICD-10-CM diagnosis codes — the conditions a
 * general pediatric practice sees repeatedly. See the "Diagnosis is a
 * free-text string" review: this table plus `searchTerms` is what lets a
 * clinician find a code faster than typing free text, which is the only
 * thing that gets coded diagnosis actually adopted. Loaded before any full
 * ICD-10-CM import so this clinic's day-to-day list stays fast to search.
 *
 * `system` is stored on every row (not a bare code) so adding SNOMED CT
 * later is an additional row set, not a schema change.
 */
const DIAGNOSIS_CODES: {
  code: string; display: string; searchTerms: string[]; isBillable?: boolean;
}[] = [
  { code: 'J00',       display: 'Acute nasopharyngitis [common cold]',                          searchTerms: ['cold', 'common cold', 'nasopharyngitis', 'URI'] },
  { code: 'J06.9',     display: 'Acute upper respiratory infection, unspecified',                searchTerms: ['URI', 'upper respiratory infection'] },
  { code: 'J02.9',     display: 'Acute pharyngitis, unspecified',                                searchTerms: ['sore throat', 'pharyngitis'] },
  { code: 'J03.90',    display: 'Acute tonsillitis, unspecified',                                searchTerms: ['tonsillitis'] },
  { code: 'J20.9',     display: 'Acute bronchitis, unspecified',                                 searchTerms: ['bronchitis'] },
  { code: 'J18.9',     display: 'Pneumonia, unspecified organism',                                searchTerms: ['pneumonia'] },
  { code: 'H66.90',    display: 'Otitis media, unspecified, unspecified ear',                    searchTerms: ['AOM', 'acute otitis media', 'ear infection', 'ear infxn', 'otitis media'] },
  { code: 'H65.90',    display: 'Unspecified nonsuppurative otitis media, unspecified ear',      searchTerms: ['otitis media with effusion', 'glue ear', 'OME'] },
  { code: 'H10.9',     display: 'Unspecified conjunctivitis',                                    searchTerms: ['pink eye', 'conjunctivitis'] },
  { code: 'J45.909',   display: 'Unspecified asthma, uncomplicated',                             searchTerms: ['asthma'] },
  { code: 'J45.20',    display: 'Mild intermittent asthma, uncomplicated',                       searchTerms: ['asthma', 'mild intermittent asthma'] },
  { code: 'J30.9',     display: 'Allergic rhinitis, unspecified',                                searchTerms: ['allergic rhinitis', 'hay fever'] },
  { code: 'A08.4',     display: 'Viral intestinal infection, unspecified',                       searchTerms: ['viral gastroenteritis', 'stomach flu', 'gastro'] },
  { code: 'K59.00',    display: 'Constipation, unspecified',                                     searchTerms: ['constipation'] },
  { code: 'K21.9',     display: 'Gastro-esophageal reflux disease without esophagitis',          searchTerms: ['GERD', 'reflux', 'acid reflux'] },
  { code: 'R10.9',     display: 'Unspecified abdominal pain',                                    searchTerms: ['stomach ache', 'abdominal pain', 'tummy ache'] },
  { code: 'R50.9',     display: 'Fever, unspecified',                                            searchTerms: ['fever', 'pyrexia'] },
  { code: 'R05.9',     display: 'Cough, unspecified',                                            searchTerms: ['cough'] },
  { code: 'R56.00',    display: 'Simple febrile convulsions',                                    searchTerms: ['febrile seizure', 'febrile convulsion'] },
  { code: 'L20.9',     display: 'Atopic dermatitis, unspecified',                                searchTerms: ['eczema', 'atopic dermatitis'] },
  { code: 'L30.9',     display: 'Dermatitis, unspecified',                                       searchTerms: ['rash', 'dermatitis'] },
  { code: 'L22',       display: 'Diaper dermatitis',                                             searchTerms: ['diaper rash', 'nappy rash'] },
  { code: 'B37.9',     display: 'Candidiasis, unspecified',                                      searchTerms: ['thrush', 'yeast infection', 'candidiasis'] },
  { code: 'B01.9',     display: 'Varicella without complication',                                searchTerms: ['chickenpox', 'varicella'] },
  { code: 'B08.4',     display: 'Enteroviral vesicular stomatitis with exanthem',                searchTerms: ['hand foot and mouth', 'hand foot mouth', 'HFMD'] },
  { code: 'N39.0',     display: 'Urinary tract infection, site not specified',                   searchTerms: ['UTI', 'urinary tract infection'] },
  { code: 'D50.9',     display: 'Iron deficiency anemia, unspecified',                           searchTerms: ['anemia', 'iron deficiency'] },
  { code: 'E55.9',     display: 'Vitamin D deficiency, unspecified',                             searchTerms: ['vitamin D deficiency'] },
  { code: 'E66.9',     display: 'Obesity, unspecified',                                          searchTerms: ['obesity', 'overweight'] },
  { code: 'F90.9',     display: 'Attention-deficit hyperactivity disorder, unspecified type',    searchTerms: ['ADHD', 'attention deficit'] },
  { code: 'F80.9',     display: 'Developmental disorder of speech and language, unspecified',    searchTerms: ['speech delay', 'language delay'] },
  { code: 'R62.50',    display: 'Unspecified lack of expected normal physiological development in childhood', searchTerms: ['developmental delay', 'global delay'] },
  { code: 'P59.9',     display: 'Neonatal jaundice, unspecified',                                searchTerms: ['jaundice', 'newborn jaundice'] },
  { code: 'S00.93XA',  display: 'Contusion of unspecified part of head, initial encounter',      searchTerms: ['head bump', 'bruise', 'contusion'] },
  { code: 'Z00.129',   display: 'Encounter for routine child health examination without abnormal findings', searchTerms: ['well child', 'checkup', 'annual physical'] },
  { code: 'Z23',       display: 'Encounter for immunization',                                    searchTerms: ['vaccination visit', 'immunization'] },
];

/**
 * SEC-017 fix: generate a random, base64url-encoded password for each seed user.
 *
 * The original seed used the hardcoded string "Password123!" which was also
 * printed verbatim in README.md. Any freshly provisioned environment was
 * immediately fully compromised if seeded before credentials were rotated.
 *
 * New behaviour:
 *  - Each seed user receives a unique, 16-byte random password (24 base64url chars).
 *  - Passwords are printed once to stdout at seed time — save them before they scroll away.
 *  - Nothing is stored in source code or documentation.
 *
 * ⚠️  IMPORTANT: copy the printed credentials to a password manager immediately.
 *     Re-running the seed does NOT regenerate passwords for existing accounts
 *     (upsert with update:{} means existing records are untouched).
 *     To force a reset, delete the user rows first or run a manual UPDATE.
 */
function generatePassword(): string {
  return randomBytes(16).toString('base64url'); // 22-24 URL-safe chars, high entropy
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROWTH MEASUREMENTS
//  Well-child visit history so the growth charts have data to render.
//  See GROWTH-DATA-WARNING.md before trusting the percentile numbers.
// ═══════════════════════════════════════════════════════════════════════════

// ── WHO 2006 LMS values at well-child visit ages ─────────────────────────────
// [L, M, S] keyed by age in months. Subset of the full 0–60 tables — only the
// ages this seed actually measures at.
// Source: WHO Multicentre Growth Reference Study Group (2006).
// ⚠️ Verify against https://www.who.int/tools/child-growth-standards before clinical use.

type LMS = [number, number, number];
type AgeTable = Record<number, LMS>;

const LMS_TABLES: Record<'weight' | 'height' | 'head', Record<'MALE' | 'FEMALE', AgeTable>> = {
  weight: {
    MALE: {
      0: [0.3487, 3.3464, 0.14602],   1: [0.2297, 4.4709, 0.13395],
      2: [0.197, 5.5675, 0.12385],    4: [0.1553, 7.0023, 0.11316],
      6: [0.1257, 7.934, 0.1066],     9: [0.0917, 8.9014, 0.09956],
      12: [0.0648, 9.6479, 0.09375],  15: [0.0427, 10.3108, 0.08833],
      18: [0.024, 10.9385, 0.08379],  24: [-0.0024, 12.1515, 0.07914],
      30: [-0.0233, 13.3525, 0.08338], 36: [-0.0386, 14.555, 0.0865],
      42: [-0.0503, 15.7589, 0.08886], 48: [-0.0598, 16.9602, 0.09071],
      54: [-0.0675, 18.1543, 0.09221], 60: [-0.0741, 19.339, 0.09346],
    },
    FEMALE: {
      0: [0.3809, 3.2322, 0.14171],   1: [0.1714, 4.1873, 0.13724],
      2: [0.0962, 5.1282, 0.13],      4: [-0.005, 6.4237, 0.12402],
      6: [-0.0756, 7.2981, 0.12204],  9: [-0.1507, 8.2223, 0.12222],
      12: [-0.2024, 8.9481, 0.12327], 15: [-0.2384, 9.5688, 0.12369],
      18: [-0.2637, 10.0722, 0.12416], 24: [-0.2736, 10.8499, 0.1258],
      30: [-0.2949, 11.7651, 0.12979], 36: [-0.3115, 12.6741, 0.13241],
      42: [-0.3246, 13.5632, 0.13439], 48: [-0.3351, 14.4368, 0.13602],
      54: [-0.3439, 15.3024, 0.13748], 60: [-0.3514, 16.1664, 0.13882],
    },
  },
  height: {
    MALE: {
      0: [1, 49.8842, 0.03795],   1: [1, 54.7244, 0.03557],
      2: [1, 58.4249, 0.03424],   4: [1, 63.886, 0.0326],
      6: [1, 67.6236, 0.03143],   9: [1, 71.9687, 0.03042],
      12: [1, 75.7488, 0.02978],  15: [1, 79.1458, 0.02945],
      18: [1, 82.2587, 0.02926],  24: [1, 87.8161, 0.02933],
      30: [1, 92.7287, 0.03033],  36: [1, 97.1746, 0.03104],
      42: [1, 101.2308, 0.03154], 48: [1, 104.9504, 0.03188],
      54: [1, 108.379, 0.03211],  60: [1, 111.5514, 0.03227],
    },
    FEMALE: {
      0: [1, 49.1477, 0.0379],    1: [1, 53.6872, 0.03627],
      2: [1, 57.0673, 0.03502],   4: [1, 62.0899, 0.03323],
      6: [1, 65.7311, 0.03196],   9: [1, 70.1435, 0.03063],
      12: [1, 74.015, 0.02985],   15: [1, 77.5099, 0.02937],
      18: [1, 80.6979, 0.02904],  24: [1, 86.3218, 0.02891],
      30: [1, 91.1186, 0.02985],  36: [1, 95.3333, 0.03042],
      42: [1, 99.0568, 0.03082],  48: [1, 102.3621, 0.03113],
      54: [1, 105.3081, 0.03139], 60: [1, 107.9507, 0.03161],
    },
  },
  head: {
    MALE: {
      0: [1, 34.4618, 0.03686],  1: [1, 37.2759, 0.03133],
      2: [1, 39.1285, 0.02997],  4: [1, 41.6317, 0.02855],
      6: [1, 43.3297, 0.02756],  9: [1, 44.9332, 0.02665],
      12: [1, 45.7949, 0.02613], 15: [1, 46.2936, 0.0258],
      18: [1, 46.622, 0.02557],  24: [1, 47.0226, 0.02527],
      30: [1, 47.2527, 0.02507], 36: [1, 47.3991, 0.02492],
      42: [1, 47.5005, 0.02482], 48: [1, 47.5757, 0.02473],
      54: [1, 47.6347, 0.02465], 60: [1, 47.6824, 0.02459],
    },
    FEMALE: {
      0: [1, 33.8787, 0.03498],  1: [1, 36.5463, 0.03014],
      2: [1, 38.3021, 0.02874],  4: [1, 40.5217, 0.02731],
      6: [1, 42.0009, 0.02634],  9: [1, 43.4367, 0.02541],
      12: [1, 44.3626, 0.02487], 15: [1, 45.0019, 0.02455],
      18: [1, 45.4758, 0.02434], 24: [1, 46.1291, 0.0241],
      30: [1, 46.542, 0.02395],  36: [1, 46.812, 0.02384],
      42: [1, 46.9903, 0.02374], 48: [1, 47.1067, 0.02367],
      54: [1, 47.1795, 0.0236],  60: [1, 47.22, 0.02354],
    },
  },
};

/** Ages (months) at which a well-child visit is recorded. */
const VISIT_AGES = [0, 1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 42, 48, 54, 60];

/** Head circumference is only routinely measured up to 36 months. */
const HEAD_MEASURED_UNTIL = 36;

// ── Math ─────────────────────────────────────────────────────────────────────

/** Measurement value at z standard deviations from the median (inverse LMS). */
function valueAtZ([L, M, S]: LMS, z: number): number {
  if (Math.abs(L) < 1e-8) return M * Math.exp(S * z);
  const inner = 1 + L * S * z;
  if (inner <= 0) return M;
  return M * Math.pow(inner, 1 / L);
}

/** Deterministic PRNG (mulberry32) so re-seeding reproduces identical data. */
function makeRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Growth patterns ──────────────────────────────────────────────────────────
/**
 * Each pattern returns the target z-score at a given age, so a patient's
 * trajectory can bend the way real ones do instead of tracking one flat line.
 */
type Pattern = {
  name: string;
  note: string;
  /** Target weight z-score at a given age. */
  zAt: (ageMonths: number) => number;
  /**
   * How closely height tracks the weight channel. Below 1 means height holds
   * up better than weight — the signature of weight-faltering. Kept high
   * enough that BMI stays clinically plausible.
   */
  heightZFactor: number;
};

const PATTERNS: Pattern[] = [
  {
    name: 'steady-average',
    note: 'Tracks close to the 50th percentile throughout — unremarkable, healthy growth.',
    zAt: () => 0.1,
    heightZFactor: 0.85,
  },
  {
    name: 'steady-small',
    note: 'Consistently around the 15th percentile. Small but tracking their own channel — normal variant.',
    zAt: () => -1.0,
    heightZFactor: 0.9,
  },
  {
    name: 'steady-large',
    note: 'Consistently around the 85th percentile. Large but proportionate.',
    zAt: () => 1.0,
    heightZFactor: 0.9,
  },
  {
    name: 'faltering',
    note: 'Average until 6 months, then crosses downward and plateaus near the 4th percentile — the pattern that should trigger a feeding review.',
    // Falls to -1.75 SD by ~24 months, then holds. Weight gain slows but never
    // reverses: a real 6-month weight LOSS in a toddler is a different (and
    // much more alarming) presentation than growth faltering.
    zAt: (m) => (m <= 6 ? 0.2 : Math.max(-1.4, 0.2 - (m - 6) * 0.09)),
    // Height holds up better than weight, but not so much that BMI collapses.
    heightZFactor: 0.85,
  },
  {
    name: 'preterm-catchup',
    note: 'Born small, climbing steadily into the normal range — textbook catch-up growth.',
    zAt: (m) => Math.min(-0.1, -2.6 + m * 0.11),
    heightZFactor: 0.85,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function ageInMonths(dob: Date, at: Date): number {
  return (at.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

function dateAtAge(dob: Date, months: number): Date {
  const d = new Date(dob);
  d.setMonth(d.getMonth() + months);
  // Visits land mid-morning on a weekday-ish schedule.
  d.setHours(9 + (months % 4), (months * 7) % 60, 0, 0);
  return d;
}

function round(v: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

/**
 * Backfill well-child visits (appointment + vital signs) for every patient.
 *
 * VitalSign.appointmentId is `@unique` and REQUIRED — a vital sign cannot exist
 * without its own appointment — so each historical measurement gets a matching
 * COMPLETED CHECKUP appointment dated to the visit.
 *
 * Idempotent: each seeded appointment carries
 *   reasonForVisit = "WELL_CHILD_SEED:<mrn>:<ageMonths>"
 * Re-running skips visits that already exist. Pass --reset-growth to delete
 * rows matching that marker and regenerate them.
 */
async function seedGrowthMeasurements(
  patients: { id: string; mrn: string; firstName: string; lastName: string; gender: Gender; dateOfBirth: Date }[],
  doctorId: string,
  recordedById: string,
) {
  if (process.argv.includes('--reset-growth')) {
    // Vital signs cascade from their appointments, so removing the seeded
    // appointments removes their vitals too.
    const del = await prisma.appointment.deleteMany({
      where: { reasonForVisit: { startsWith: 'WELL_CHILD_SEED' } },
    });
    console.log(`♻️  --reset-growth: removed ${del.count} previously seeded well-child visits`);
  }

  let totalVisits = 0;
  let totalSkipped = 0;
  const summary: string[] = [];

  for (const [idx, patient] of patients.entries()) {
    const rng = makeRng(patient.mrn);
    const pattern = PATTERNS[idx % PATTERNS.length];

    // WHO publishes boys'/girls' standards only; OTHER is charted against the
    // boys' standard, matching PatientsService.getGrowthChart().
    const sex: 'MALE' | 'FEMALE' = patient.gender === Gender.FEMALE ? 'FEMALE' : 'MALE';

    const currentAge = ageInMonths(patient.dateOfBirth, new Date());
    const visits = VISIT_AGES.filter((m) => m <= Math.min(currentAge, 60));

    if (!visits.length) {
      summary.push(`   ${patient.mrn}  ${patient.firstName} — newborn, no visits due yet`);
      continue;
    }

    // ── Birth measurements on the patient record ─────────────────────────
    const zBirth = pattern.zAt(0);
    await prisma.patient.update({
      where: { id: patient.id },
      data: {
        birthWeightKg: round(valueAtZ(LMS_TABLES.weight[sex][0], zBirth), 2),
        birthHeightCm: round(valueAtZ(LMS_TABLES.height[sex][0], zBirth * pattern.heightZFactor), 1),
        gestationalAge: pattern.name === 'preterm-catchup' ? 33 : 39,
      },
    });

    // ── Visits ───────────────────────────────────────────────────────────
    let created = 0;
    let skipped = 0;
    let lastWeight: number | null = null;

    for (const months of visits) {
      const visitDate = dateAtAge(patient.dateOfBirth, months);
      if (visitDate > new Date()) continue;

      const marker = `WELL_CHILD_SEED:${patient.mrn}:${months}`;
      const already = await prisma.appointment.findFirst({
        where: { patientId: patient.id, reasonForVisit: marker },
        select: { id: true },
      });
      if (already) { skipped++; continue; }

      // Target z for this age, plus measurement jitter (±0.12 SD).
      const z = pattern.zAt(months) + (rng() - 0.5) * 0.24;

      // Guard: jitter must never manufacture a weight loss between visits.
      // A toddler losing weight across months is a distinct — and far more
      // alarming — clinical picture than growth faltering.
      let weightKg = round(valueAtZ(LMS_TABLES.weight[sex][months], z), 2);
      if (lastWeight !== null && weightKg < lastWeight) {
        weightKg = round(lastWeight + 0.02 + rng() * 0.06, 2);
      }
      lastWeight = weightKg;

      const heightCm = round(valueAtZ(LMS_TABLES.height[sex][months], z * pattern.heightZFactor), 1);
      const headCm =
        months <= HEAD_MEASURED_UNTIL
          ? round(valueAtZ(LMS_TABLES.head[sex][months], z * 0.6), 1)
          : null;
      const bmi = round(weightKg / (heightCm / 100) ** 2, 2);

      // Vitals scale with age — newborns run faster heart and respiratory rates.
      const heartRate       = Math.round(140 - months * 0.85 + (rng() - 0.5) * 10);
      const respiratoryRate = Math.round(42 - months * 0.32 + (rng() - 0.5) * 6);
      const temperatureC    = round(36.6 + (rng() - 0.5) * 0.6, 1);
      const oxygenSaturation = round(97 + rng() * 2.5, 0);

      const appointment = await prisma.appointment.create({
        data: {
          patientId: patient.id,
          doctorId,
          scheduledAt: visitDate,
          durationMinutes: 30,
          type: AppointmentType.CHECKUP,
          status: AppointmentStatus.COMPLETED,
          chiefComplaint: months === 0 ? 'Newborn examination' : `${months}-month well-child visit`,
          reasonForVisit: marker,
          checkedInAt: visitDate,
          startedAt: visitDate,
          completedAt: new Date(visitDate.getTime() + 30 * 60_000),
        },
      });

      await prisma.vitalSign.create({
        data: {
          appointmentId: appointment.id,
          patientId: patient.id,
          recordedById,
          weightKg,
          heightCm,
          headCircumference: headCm,
          bmi,
          temperatureC,
          heartRate,
          respiratoryRate,
          oxygenSaturation,
          recordedAt: visitDate,
        },
      });

      created++;
    }

    totalVisits += created;
    totalSkipped += skipped;

    summary.push(
      `   ${patient.mrn}  ${(patient.firstName + ' ' + patient.lastName).padEnd(20)}` +
      `${sex.padEnd(7)} ${String(Math.floor(currentAge)).padStart(2)}mo  ` +
      `${String(created).padStart(2)} new  [${pattern.name}]`,
    );
  }

  console.log(summary.join('\n'));
  console.log(
    `✅ ${totalVisits} well-child visits with vital signs seeded` +
    (totalSkipped ? ` (${totalSkipped} already existed)` : ''),
  );
}

async function main() {
  console.log('🌱 Seeding PediTrack database...\n');

  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  // ── Vaccines ──────────────────────────────────────────
  for (const v of VACCINES) {
    await prisma.vaccine.upsert({
      where: { code: v.code },
      update: {},
      create: v,
    });
  }
  console.log(`✅ ${VACCINES.length} vaccines seeded`);

  // ── Screening instruments ───────────────────────────────
  for (const s of SCREENING_INSTRUMENTS) {
    await prisma.screeningInstrument.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    });
  }
  console.log(`✅ ${SCREENING_INSTRUMENTS.length} screening instruments seeded`);

  // ── Milestone definitions ────────────────────────────────
  // Count assertion (per MILESTONE-DATA-SOURCE.md): a truncated or malformed
  // source list must fail the seed loudly rather than silently ship an
  // incomplete checklist. 12 checklist ages × 4 domains = 48 groups.
  const expectedGroups = MILESTONE_CHECKLIST_AGES.length * 4;
  if (MILESTONE_CHECKLIST_DATA.length !== expectedGroups) {
    throw new Error(
      `Milestone checklist data incomplete: expected ${expectedGroups} age/domain groups, ` +
      `found ${MILESTONE_CHECKLIST_DATA.length}`,
    );
  }
  for (const d of MILESTONE_DEFINITIONS) {
    await prisma.milestoneDefinition.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
  }
  console.log(
    `✅ ${MILESTONE_DEFINITIONS.length} milestone definitions seeded ` +
    `(${MILESTONE_CHECKLIST_DATA.length} age/domain groups, CDC 2022 revision)`,
  );

  // ── Medicine dose references ─────────────────────────────
  for (const m of MEDICINE_DOSE_REFERENCES) {
    await prisma.medicineDoseReference.upsert({
      where: { genericName: m.genericName },
      update: {},
      create: m,
    });
  }
  console.log(`✅ ${MEDICINE_DOSE_REFERENCES.length} medicine dose references seeded`);

  // ── Diagnosis codes ───────────────────────────────────
  for (const d of DIAGNOSIS_CODES) {
    await prisma.diagnosisCode.upsert({
      where: { system_code: { system: CodeSystem.ICD10CM, code: d.code } },
      update: {},
      create: {
        system: CodeSystem.ICD10CM,
        code: d.code,
        display: d.display,
        searchTerms: d.searchTerms,
        isBillable: d.isBillable ?? true,
        isPediatric: true,
      },
    });
  }
  console.log(`✅ ${DIAGNOSIS_CODES.length} diagnosis codes seeded (ICD-10-CM pediatric short-list)`);

  // ── Users ─────────────────────────────────────────────
  // SEC-017 fix: generate unique random passwords; print once to stdout only.
  const credentials: Array<{ role: string; email: string; password: string }> = [];

  async function upsertUser(
    email: string,
    role: string,
    extra: object,
  ) {
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, rounds);
    credentials.push({ role, email, password: plainPassword });

    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, ...extra } as any,
    });
  }

  const admin = await upsertUser('admin@peditrack.app', 'ADMIN', {
    role: UserRole.ADMIN,
    firstName: 'Clinic',
    lastName: 'Administrator',
    phone: '+63 917 000 0001',
  });

  const doctor = await upsertUser('doctor@peditrack.app', 'DOCTOR', {
    role: UserRole.DOCTOR,
    firstName: 'Maria',
    lastName: 'Santos',
    phone: '+63 917 000 0002',
    licenseNumber: 'PRC-0123456',
    specialty: 'General Pediatrics',
  });

  const nurse = await upsertUser('nurse@peditrack.app', 'NURSE', {
    role: UserRole.NURSE,
    firstName: 'Ana',
    lastName: 'Reyes',
    phone: '+63 917 000 0003',
  });

  await upsertUser('reception@peditrack.app', 'RECEPTIONIST', {
    role: UserRole.RECEPTIONIST,
    firstName: 'Jose',
    lastName: 'Cruz',
    phone: '+63 917 000 0004',
  });

  console.log('✅ 4 staff users seeded');

  // ── Patients ──────────────────────────────────────────
  const yearsAgo = (n: number, m = 0) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - n);
    d.setMonth(d.getMonth() - m);
    return d;
  };

  const patientSeeds = [
    { mrn: 'PT-2026-00001', firstName: 'Liam',   lastName: 'Dela Cruz', gender: Gender.MALE,   dob: yearsAgo(3, 2),  bloodType: BloodType.O_POSITIVE, allergies: ['Penicillin'], guardian: { firstName: 'Rosa',   lastName: 'Dela Cruz', relationship: 'Mother', phone: '+63 918 111 1111' } },
    { mrn: 'PT-2026-00002', firstName: 'Sofia',  lastName: 'Garcia',    gender: Gender.FEMALE, dob: yearsAgo(1, 5),  bloodType: BloodType.A_POSITIVE, allergies: [],             guardian: { firstName: 'Miguel', lastName: 'Garcia',    relationship: 'Father', phone: '+63 918 222 2222' } },
    { mrn: 'PT-2026-00003', firstName: 'Noah',   lastName: 'Reyes',     gender: Gender.MALE,   dob: yearsAgo(0, 8),  bloodType: BloodType.B_POSITIVE, allergies: ['Peanuts'],    guardian: { firstName: 'Carla',  lastName: 'Reyes',     relationship: 'Mother', phone: '+63 918 333 3333' } },
    { mrn: 'PT-2026-00004', firstName: 'Emma',   lastName: 'Bautista',  gender: Gender.FEMALE, dob: yearsAgo(5, 0),  bloodType: BloodType.AB_POSITIVE, allergies: [],            guardian: { firstName: 'Elena',  lastName: 'Bautista',  relationship: 'Mother', phone: '+63 918 444 4444' } },
    { mrn: 'PT-2026-00005', firstName: 'Lucas',  lastName: 'Mendoza',   gender: Gender.MALE,   dob: yearsAgo(2, 6),  bloodType: BloodType.O_NEGATIVE, allergies: ['Dust mites'], guardian: { firstName: 'Paolo',  lastName: 'Mendoza',   relationship: 'Father', phone: '+63 918 555 5555' } },
  ];

  const createdPatients = [];
  for (const p of patientSeeds) {
    const patient = await prisma.patient.upsert({
      where: { mrn: p.mrn },
      update: {},
      create: {
        mrn: p.mrn,
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: p.dob,
        gender: p.gender,
        bloodType: p.bloodType,
        allergies: p.allergies,
        guardians: {
          create: {
            firstName: p.guardian.firstName,
            lastName: p.guardian.lastName,
            relationship: p.guardian.relationship,
            phone: p.guardian.phone,
            isPrimary: true,
            isEmergencyContact: true,
          },
        },
      },
    });
    createdPatients.push(patient);
  }
  console.log(`✅ ${createdPatients.length} patients with guardians seeded`);

  // ── Appointments ──────────────────────────────────────
  const daysFromNow = (n: number, hour = 9) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  const existing = await prisma.appointment.count();
  if (existing === 0) {
    await prisma.appointment.createMany({
      data: [
        { patientId: createdPatients[0].id, doctorId: doctor.id, scheduledAt: daysFromNow(0, 9),  type: AppointmentType.CHECKUP,     status: AppointmentStatus.CONFIRMED, chiefComplaint: 'Routine well-child visit' },
        { patientId: createdPatients[1].id, doctorId: doctor.id, scheduledAt: daysFromNow(0, 10), type: AppointmentType.VACCINATION, status: AppointmentStatus.CONFIRMED, chiefComplaint: 'MMR dose 1' },
        { patientId: createdPatients[2].id, doctorId: doctor.id, scheduledAt: daysFromNow(1, 11), type: AppointmentType.SICK_VISIT,  status: AppointmentStatus.PENDING,   chiefComplaint: 'Fever and cough for 2 days' },
        { patientId: createdPatients[3].id, doctorId: doctor.id, scheduledAt: daysFromNow(3, 14), type: AppointmentType.FOLLOW_UP,   status: AppointmentStatus.PENDING,   chiefComplaint: 'Follow-up on asthma management' },
        { patientId: createdPatients[4].id, doctorId: doctor.id, scheduledAt: daysFromNow(-7, 9), type: AppointmentType.CHECKUP,     status: AppointmentStatus.COMPLETED, chiefComplaint: 'Annual physical exam', completedAt: daysFromNow(-7, 10) },
      ],
    });
    console.log('✅ 5 appointments seeded');
  }

  // ── Patient diagnoses ─────────────────────────────────
  // Demonstrates the coded problem list: Emma's asthma follow-up gets a real
  // coded, patient-level diagnosis instead of a free-text guess, and Liam
  // gets a resolved past episode — showing that a code plus status survives
  // the appointment it was made in.
  if ((await prisma.patientDiagnosis.count()) === 0) {
    const [asthmaCode, aomCode] = await Promise.all([
      prisma.diagnosisCode.findUnique({ where: { system_code: { system: CodeSystem.ICD10CM, code: 'J45.909' } } }),
      prisma.diagnosisCode.findUnique({ where: { system_code: { system: CodeSystem.ICD10CM, code: 'H66.90' } } }),
    ]);
    const followUpAppt = await prisma.appointment.findFirst({
      where: { patientId: createdPatients[3].id, chiefComplaint: 'Follow-up on asthma management' },
    });

    if (asthmaCode) {
      await prisma.patientDiagnosis.create({
        data: {
          patientId: createdPatients[3].id, // Emma
          codeId: asthmaCode.id,
          appointmentId: followUpAppt?.id,
          diagnosedById: doctor.id,
          status: DiagnosisStatus.CHRONIC,
          certainty: DiagnosisCertainty.CONFIRMED,
          isPrimary: true,
          onsetDate: yearsAgo(2),
        },
      });
    }
    if (aomCode) {
      await prisma.patientDiagnosis.create({
        data: {
          patientId: createdPatients[0].id, // Liam
          codeId: aomCode.id,
          diagnosedById: doctor.id,
          status: DiagnosisStatus.RESOLVED,
          certainty: DiagnosisCertainty.CONFIRMED,
          isPrimary: true,
          onsetDate: yearsAgo(0, 4),
          resolvedDate: yearsAgo(0, 3),
          clinicalNote: 'Treated with an amoxicillin alternative given the penicillin allergy on file.',
        },
      });
    }
    console.log('✅ Example patient diagnoses seeded');
  }

  // ── Vaccination records ───────────────────────────────
  const bcg = await prisma.vaccine.findUnique({ where: { code: 'BCG' } });
  const hepb = await prisma.vaccine.findUnique({ where: { code: 'HEPB' } });

  if (bcg && hepb) {
    for (const patient of createdPatients.slice(0, 3)) {
      const birthDate = patient.dateOfBirth;
      await prisma.vaccinationRecord.upsert({
        where: { patientId_vaccineId_doseNumber: { patientId: patient.id, vaccineId: bcg.id, doseNumber: 1 } },
        update: {},
        create: {
          patientId: patient.id,
          vaccineId: bcg.id,
          administeredById: nurse.id,
          doseNumber: 1,
          administeredAt: birthDate,
          batchNumber: 'BCG-2023-A47',
          site: 'Left deltoid',
          route: 'ID',
        },
      });

      const nextDue = new Date(birthDate);
      nextDue.setDate(nextDue.getDate() + 42);
      await prisma.vaccinationRecord.upsert({
        where: { patientId_vaccineId_doseNumber: { patientId: patient.id, vaccineId: hepb.id, doseNumber: 1 } },
        update: {},
        create: {
          patientId: patient.id,
          vaccineId: hepb.id,
          administeredById: nurse.id,
          doseNumber: 1,
          administeredAt: birthDate,
          batchNumber: 'HEPB-2023-B12',
          site: 'Right thigh',
          route: 'IM',
          nextDueDate: nextDue,
        },
      });
    }
    console.log('✅ Vaccination records seeded');
  }

  // ── Growth measurements ───────────────────────────────
  // Runs after the demo appointments above so the `existing === 0` check there
  // sees a clean table on first run. Idempotent on re-runs.
  console.log('\n🌱 Seeding growth measurements...');
  await seedGrowthMeasurements(createdPatients, doctor.id, nurse?.id ?? doctor.id);

  // ── Print credentials ─────────────────────────────────
  // SEC-017 fix: passwords are printed once here and never stored in source.
  console.log('\n───────────────────────────────────────────────────────');
  console.log('🎉 Seed complete!\n');
  console.log('⚠️  SAVE THESE CREDENTIALS NOW — they will not be shown again.');
  console.log('   Existing accounts are NOT overwritten by re-running the seed.\n');

  const colW = Math.max(...credentials.map((c) => c.email.length)) + 2;
  for (const { role, email, password } of credentials) {
    console.log(`  [${role.padEnd(12)}]  ${email.padEnd(colW)}  ${password}`);
  }

  console.log('\n  ➜  Change all passwords via the API before going live:');
  console.log('     PATCH /api/v1/users/:id with { "password": "<new>" }');
  console.log('───────────────────────────────────────────────────────');

  console.log('\n── Growth patterns assigned ───────────────────────────');
  for (const p of PATTERNS) {
    console.log(`   ${p.name.padEnd(17)} ${p.note}`);
  }
  console.log('\n   View a chart at:  /patients/<id>/growth');
  console.log('   Re-seed growth only:  npm run db:seed -- --reset-growth');
  console.log('\n   ⚠️  Percentile accuracy: see GROWTH-DATA-WARNING.md — the LMS');
  console.log('       reference tables are unverified and must be replaced with');
  console.log('       official WHO data before any clinical use.');
  console.log('───────────────────────────────────────────────────────\n');

  console.log('   ⚠️  Milestone checklist provenance: see MILESTONE-DATA-SOURCE.md —');
  console.log('       the 2/4/6/9-month entries could not be cross-verified against');
  console.log('       a second source and should be spot-checked before clinical use.');
  console.log('───────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
