-- ShuttleCoach Seed Data
-- Version: 002
-- Description: Sample data for development and testing
-- Date: 2025-01-01

-- ============================================================================
-- SEED USERS (Coaches)
-- ============================================================================
-- Note: All passwords are hashed versions of 'password123'
-- In production, use proper bcrypt hashing

INSERT INTO users (id, username, password_hash, role, name, email, specialization) VALUES
  ('11111111-1111-1111-1111-111111111111', 'headcoach', '$2b$10$Np0xsFrxhx4oUBl6mgPWhemXkYQeyJfBhL6xvyz1iTT7a.UG2Apn6', 'HEAD_COACH', 'Sumit Dali', 'sumit@shuttlecoach.com', 'Advanced Training'),
  ('22222222-2222-2222-2222-222222222222', 'assistant1', '$2b$10$Np0xsFrxhx4oUBl6mgPWhemXkYQeyJfBhL6xvyz1iTT7a.UG2Apn6', 'ASSISTANT_COACH', 'Priya Sharma', 'priya@shuttlecoach.com', 'Beginner Training'),
  ('33333333-3333-3333-3333-333333333333', 'assistant2', '$2b$10$Np0xsFrxhx4oUBl6mgPWhemXkYQeyJfBhL6xvyz1iTT7a.UG2Apn6', 'ASSISTANT_COACH', 'Amit Patel', 'amit@shuttlecoach.com', 'Intermediate Training');

-- ============================================================================
-- SEED BATCHES
-- ============================================================================

INSERT INTO batches (id, name, schedule, assigned_coach_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Morning Beginners', 'Mon/Wed/Fri 6:00-7:00 AM', '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Evening Intermediate', 'Tue/Thu/Sat 5:00-6:30 PM', '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Advanced Training', 'Mon-Fri 4:00-6:00 PM', '11111111-1111-1111-1111-111111111111');

-- ============================================================================
-- SEED STUDENTS
-- ============================================================================

INSERT INTO students (
  id, full_name, date_of_birth, gender, contact_phone, email, 
  guardian_name, guardian_phone, baid_number, batch_id, assigned_coach_id,
  height, weight, blood_group, strengths, weaknesses, skill_level
) VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    'Aarav Mehta',
    '2010-03-15',
    'Male',
    '+91-9876543210',
    'aarav.mehta@email.com',
    'Sanjay Mehta',
    '+91-9876543211',
    'BAID-2024-001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    165.5,
    58.2,
    'A+',
    ARRAY['Footwork', 'Smash', 'Court Coverage'],
    ARRAY['Backhand Clear', 'Net Play'],
    'Intermediate'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'Diya Singh',
    '2011-07-22',
    'Female',
    '+91-9876543220',
    'diya.singh@email.com',
    'Kavita Singh',
    '+91-9876543221',
    'BAID-2024-002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    158.0,
    52.5,
    'B+',
    ARRAY['Service', 'Drop Shot', 'Agility'],
    ARRAY['Power Smash', 'Overhead Clear'],
    'Beginner'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'Rohan Iyer',
    '2009-11-08',
    'Male',
    '+91-9876543230',
    'rohan.iyer@email.com',
    'Lakshmi Iyer',
    '+91-9876543231',
    'BAID-2024-003',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    172.0,
    64.8,
    'O+',
    ARRAY['Forehand Drive', 'Smash', 'Defense'],
    ARRAY['Net Play', 'Backhand Service'],
    'Intermediate'
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'Ananya Reddy',
    '2008-05-18',
    'Female',
    '+91-9876543240',
    'ananya.reddy@email.com',
    'Venkat Reddy',
    '+91-9876543241',
    'BAID-2024-004',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    168.5,
    59.3,
    'A-',
    ARRAY['Backhand Clear', 'Rally Consistency', 'Stamina'],
    ARRAY['Power on Forehand', 'Net Kill'],
    'Advanced'
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    'Arjun Nair',
    '2012-09-30',
    'Male',
    '+91-9876543250',
    'arjun.nair@email.com',
    'Pradeep Nair',
    '+91-9876543251',
    NULL,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    155.0,
    48.5,
    'B-',
    ARRAY['Enthusiasm', 'Quick Learner'],
    ARRAY['Footwork', 'Service', 'Backhand'],
    'Beginner'
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    'Saanvi Gupta',
    '2007-12-12',
    'Female',
    '+91-9876543260',
    'saanvi.gupta@email.com',
    NULL,
    NULL,
    'BAID-2024-005',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '11111111-1111-1111-1111-111111111111',
    170.0,
    62.0,
    'AB+',
    ARRAY['Smash Power', 'Court Awareness', 'Tactical Play', 'Footwork'],
    ARRAY['Consistency under pressure'],
    'Advanced'
  );

-- ============================================================================
-- SEED SKILL ASSESSMENTS
-- ============================================================================

INSERT INTO skill_assessments (student_id, cycle_key, recorded_by, scores, is_locked) VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    'Nov-Dec 2024',
    'Priya Sharma',
    '{
      "forehand": {"Clear": 2, "Drop": 2, "Smash": 3, "Drive": 2, "NetShot": 2, "Lift": 2, "CrossDrop": 1, "Slice": 1, "Push": 2, "Tap": 2},
      "backhand": {"Clear": 1, "Drop": 2, "Smash": 1, "Drive": 2, "NetShot": 1, "Lift": 2, "CrossDrop": 1, "Slice": 1, "Push": 1, "Tap": 1},
      "return": {"HighServe": 2, "LowServe": 2, "FlatDrive": 2, "Drop": 2, "Lift": 2, "Push": 2, "NetKill": 1, "BlockReturn": 2, "CrossCourt": 1, "Straight": 2},
      "service": {"HighServe": 2, "LowServe": 2, "FlickServe": 1, "DriveServe": 1, "BackhandServe": 1, "ShortServe": 2, "LongServe": 2, "DoubleService": 2, "Variation": 1, "Placement": 2},
      "overhead": {"Smash": 3, "Clear": 2, "DropShot": 2, "JumpSmash": 1, "SliceSmash": 1, "Placement": 2, "Power": 2, "CrossSmash": 2, "StraightSmash": 3, "RoundHead": 2},
      "rally": {"Defense": 2, "Attack": 2, "Transitions": 2, "NetPlay": 1, "MidCourt": 2, "BackCourt": 2, "Consistency": 2, "Speed": 2, "Recovery": 2, "Positioning": 2}
    }',
    true
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'Nov-Dec 2024',
    'Priya Sharma',
    '{
      "forehand": {"Clear": 1, "Drop": 1, "Smash": 1, "Drive": 1, "NetShot": 2, "Lift": 1, "CrossDrop": 0, "Slice": 0, "Push": 1, "Tap": 1},
      "backhand": {"Clear": 1, "Drop": 1, "Smash": 0, "Drive": 1, "NetShot": 1, "Lift": 1, "CrossDrop": 0, "Slice": 0, "Push": 1, "Tap": 1},
      "return": {"HighServe": 1, "LowServe": 1, "FlatDrive": 1, "Drop": 1, "Lift": 1, "Push": 1, "NetKill": 0, "BlockReturn": 1, "CrossCourt": 1, "Straight": 1},
      "service": {"HighServe": 2, "LowServe": 2, "FlickServe": 1, "DriveServe": 0, "BackhandServe": 1, "ShortServe": 2, "LongServe": 1, "DoubleService": 1, "Variation": 1, "Placement": 2},
      "overhead": {"Smash": 1, "Clear": 1, "DropShot": 1, "JumpSmash": 0, "SliceSmash": 0, "Placement": 1, "Power": 0, "CrossSmash": 1, "StraightSmash": 1, "RoundHead": 1},
      "rally": {"Defense": 1, "Attack": 1, "Transitions": 1, "NetPlay": 1, "MidCourt": 1, "BackCourt": 1, "Consistency": 1, "Speed": 1, "Recovery": 1, "Positioning": 1}
    }',
    true
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    'Nov-Dec 2024',
    'Sumit Dali',
    '{
      "forehand": {"Clear": 3, "Drop": 3, "Smash": 4, "Drive": 3, "NetShot": 3, "Lift": 3, "CrossDrop": 3, "Slice": 3, "Push": 3, "Tap": 3},
      "backhand": {"Clear": 3, "Drop": 3, "Smash": 3, "Drive": 3, "NetShot": 3, "Lift": 3, "CrossDrop": 3, "Slice": 2, "Push": 3, "Tap": 3},
      "return": {"HighServe": 3, "LowServe": 3, "FlatDrive": 3, "Drop": 3, "Lift": 3, "Push": 3, "NetKill": 3, "BlockReturn": 3, "CrossCourt": 3, "Straight": 3},
      "service": {"HighServe": 3, "LowServe": 3, "FlickServe": 3, "DriveServe": 3, "BackhandServe": 3, "ShortServe": 3, "LongServe": 3, "DoubleService": 3, "Variation": 3, "Placement": 3},
      "overhead": {"Smash": 4, "Clear": 3, "DropShot": 3, "JumpSmash": 3, "SliceSmash": 3, "Placement": 3, "Power": 4, "CrossSmash": 3, "StraightSmash": 4, "RoundHead": 3},
      "rally": {"Defense": 3, "Attack": 4, "Transitions": 3, "NetPlay": 3, "MidCourt": 3, "BackCourt": 3, "Consistency": 2, "Speed": 3, "Recovery": 3, "Positioning": 3}
    }',
    true
  );

-- ============================================================================
-- SEED FEE RECORDS
-- ============================================================================

INSERT INTO fee_records (student_id, amount, month_year, due_date, paid_date, status, payment_method, transaction_ref) VALUES
  ('44444444-4444-4444-4444-444444444444', 3000.00, '2024-12', '2024-12-05', '2024-12-03', 'PAID', 'UPI', 'UPI-2024120312345'),
  ('44444444-4444-4444-4444-444444444444', 3000.00, '2025-01', '2025-01-05', NULL, 'PENDING', NULL, NULL),
  ('55555555-5555-5555-5555-555555555555', 3000.00, '2024-12', '2024-12-05', '2024-12-10', 'PAID', 'CASH', NULL),
  ('55555555-5555-5555-5555-555555555555', 3000.00, '2025-01', '2025-01-05', NULL, 'PENDING', NULL, NULL),
  ('66666666-6666-6666-6666-666666666666', 4000.00, '2024-12', '2024-12-05', '2024-12-04', 'PAID', 'BANK_TRANSFER', 'TXN-202412040987'),
  ('66666666-6666-6666-6666-666666666666', 4000.00, '2025-01', '2025-01-05', NULL, 'PENDING', NULL, NULL),
  ('77777777-7777-7777-7777-777777777777', 4000.00, '2024-12', '2024-12-05', '2024-12-02', 'PAID', 'UPI', 'UPI-2024120287654'),
  ('77777777-7777-7777-7777-777777777777', 4000.00, '2025-01', '2025-01-05', NULL, 'PENDING', NULL, NULL),
  ('88888888-8888-8888-8888-888888888888', 3000.00, '2024-11', '2024-11-05', NULL, 'OVERDUE', NULL, NULL),
  ('88888888-8888-8888-8888-888888888888', 3000.00, '2024-12', '2024-12-05', NULL, 'OVERDUE', NULL, NULL),
  ('99999999-9999-9999-9999-999999999999', 5000.00, '2024-12', '2024-12-05', '2024-12-01', 'PAID', 'UPI', 'UPI-2024120198765'),
  ('99999999-9999-9999-9999-999999999999', 5000.00, '2025-01', '2025-01-05', NULL, 'PENDING', NULL, NULL);

-- ============================================================================
-- SEED CURRICULUM PLANS (Batch Plans)
-- ============================================================================

INSERT INTO curriculum_plans (id, cycle_key, batch_id, weeks) VALUES
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Jan-Feb 2025',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '[
      {
        "weekNumber": 1,
        "focusArea": "Basic Footwork & Grip",
        "objective": "Master basic footwork patterns and proper grip technique",
        "drills": [
          {"id": "drill-001", "name": "Four-Corner Footwork", "description": "Move to all four corners with proper technique", "category": "Footwork"},
          {"id": "drill-002", "name": "Grip Switching", "description": "Practice switching between forehand and backhand grips", "category": "Technique"}
        ]
      },
      {
        "weekNumber": 2,
        "focusArea": "Forehand Clear",
        "objective": "Develop consistent overhead forehand clear technique",
        "drills": [
          {"id": "drill-003", "name": "Shadow Clear", "description": "Practice clear motion without shuttle", "category": "Stroke Practice"},
          {"id": "drill-004", "name": "Clear to Target", "description": "Hit clears to marked target zones", "category": "Stroke Practice"}
        ]
      },
      {
        "weekNumber": 3,
        "focusArea": "Service Technique",
        "objective": "Learn high serve and low serve mechanics",
        "drills": [
          {"id": "drill-005", "name": "High Serve Practice", "description": "Practice high serves to backcourt", "category": "Service"},
          {"id": "drill-006", "name": "Low Serve Accuracy", "description": "Practice low serves to service line", "category": "Service"}
        ]
      },
      {
        "weekNumber": 4,
        "focusArea": "Net Play Basics",
        "objective": "Introduce net shots and lifts",
        "drills": [
          {"id": "drill-007", "name": "Net Shot Repetition", "description": "Multi-shuttle net shot practice", "category": "Net Play"},
          {"id": "drill-008", "name": "Net to Back", "description": "Transition from net shot to backcourt clear", "category": "Transitions"}
        ]
      },
      {
        "weekNumber": 5,
        "focusArea": "Backhand Fundamentals",
        "objective": "Develop basic backhand clear and drive",
        "drills": [
          {"id": "drill-009", "name": "Backhand Clear Drill", "description": "Overhead backhand clear practice", "category": "Stroke Practice"},
          {"id": "drill-010", "name": "Backhand Drive", "description": "Flat backhand drive to midcourt", "category": "Stroke Practice"}
        ]
      },
      {
        "weekNumber": 6,
        "focusArea": "Rally Play",
        "objective": "Sustain rallies with basic strokes",
        "drills": [
          {"id": "drill-011", "name": "Continuous Rally", "description": "Maintain 10-shot rallies", "category": "Rally"},
          {"id": "drill-012", "name": "Clear-Drop Pattern", "description": "Alternate between clears and drops", "category": "Pattern Play"}
        ]
      },
      {
        "weekNumber": 7,
        "focusArea": "Smash Introduction",
        "objective": "Learn basic smash technique and timing",
        "drills": [
          {"id": "drill-013", "name": "Shadow Smash", "description": "Practice smash motion without shuttle", "category": "Stroke Practice"},
          {"id": "drill-014", "name": "Smash to Target", "description": "Hit smashes to marked floor zones", "category": "Power Training"}
        ]
      },
      {
        "weekNumber": 8,
        "focusArea": "Assessment & Game Play",
        "objective": "Assess progress and apply skills in games",
        "drills": [
          {"id": "drill-015", "name": "Skill Test", "description": "Test all basic strokes learned", "category": "Assessment"},
          {"id": "drill-016", "name": "Controlled Match", "description": "Play controlled games focusing on form", "category": "Game Play"}
        ]
      }
    ]'
  );

-- ============================================================================
-- SEED TRAINING LOGS
-- ============================================================================

INSERT INTO training_logs (student_id, week_number, cycle_key, session_notes, is_completed, recorded_by) VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    1,
    'Nov-Dec 2024',
    'Good progress on footwork. Needs to work on maintaining ready position. Completed all drills with enthusiasm.',
    true,
    'Priya Sharma'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    2,
    'Nov-Dec 2024',
    'Forehand clear showing improvement. Focus on wrist snap for more power. Height and depth are good.',
    true,
    'Priya Sharma'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    1,
    'Nov-Dec 2024',
    'First week went well. Student is attentive and follows instructions carefully. Footwork basics understood.',
    true,
    'Priya Sharma'
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    1,
    'Nov-Dec 2024',
    'Excellent technique on all advanced drills. Working on tactical variations and deception. Ready for competition preparation.',
    true,
    'Sumit Dali'
  );

-- ============================================================================
-- SEED STUDENT USERS (for student login)
-- ============================================================================

INSERT INTO users (id, username, password_hash, role, name, email) VALUES
  ('44444444-4444-4444-4444-444444444444', 'aarav', '$2b$10$rKvVJH8YnRVH0SZLqJ3mj.xQZGX9p8YqKqVHxJ9mJ3mJ9mJ3mJ3mJ3', 'STUDENT', 'Aarav Mehta', 'aarav.mehta@email.com'),
  ('55555555-5555-5555-5555-555555555555', 'diya', '$2b$10$rKvVJH8YnRVH0SZLqJ3mj.xQZGX9p8YqKqVHxJ9mJ3mJ9mJ3mJ3mJ3', 'STUDENT', 'Diya Singh', 'diya.singh@email.com'),
  ('99999999-9999-9999-9999-999999999999', 'saanvi', '$2b$10$rKvVJH8YnRVH0SZLqJ3mj.xQZGX9p8YqKqVHxJ9mJ3mJ9mJ3mJ3mJ3', 'STUDENT', 'Saanvi Gupta', 'saanvi.gupta@email.com');

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================

-- Summary:
-- - 3 coaches (1 head coach, 2 assistant coaches)
-- - 3 batches (Morning Beginners, Evening Intermediate, Advanced Training)
-- - 6 students across different batches and skill levels
-- - 3 skill assessments (for students with varying proficiency levels)
-- - 12 fee records (showing paid, pending, and overdue statuses)
-- - 1 batch curriculum plan (8-week beginner program)
-- - 4 training logs (sample session notes)
-- - All users can login with password: password123
