-- Seed Global Drills for Badminton
-- Version: 025
-- Description: Pre-populate the drill marketplace with 54 standard badminton drills
-- These are global drills (center_id = NULL) available to all centers via the marketplace.

INSERT INTO drills (name, description, category, sport, center_id) VALUES
  -- Service (5 drills)
  ('BH Short Service', 'Short backhand service aimed at the front service line with minimal shuttle height', 'Service', 'badminton', NULL),
  ('BH Flick Service', 'Deceptive backhand flick service that lifts the shuttle quickly to the back court', 'Service', 'badminton', NULL),
  ('FH Short Service', 'Forehand short service played low over the net to the front service box', 'Service', 'badminton', NULL),
  ('FH Long Service', 'High forehand service driven deep to the back boundary line', 'Service', 'badminton', NULL),
  ('FH Flick Service', 'Quick forehand flick service aimed at catching the receiver off-guard with sudden height', 'Service', 'badminton', NULL),

  -- Service Return (6 drills)
  ('Service return STR Keep', 'Straight net return off the serve, keeping the shuttle tight and low over the net', 'Service Return', 'badminton', NULL),
  ('Service return Cross Keep', 'Cross-court net return off the serve, redirecting the shuttle low to the opposite side', 'Service Return', 'badminton', NULL),
  ('Service return STR Push', 'Straight push return placing the shuttle flat and fast to the mid-court', 'Service Return', 'badminton', NULL),
  ('Service return Cross Push', 'Cross-court push return directing the shuttle flat to the opponent''s mid-court', 'Service Return', 'badminton', NULL),
  ('Service return STR Lift', 'Straight lift return sending the shuttle high and deep to the back court', 'Service Return', 'badminton', NULL),
  ('Service return Cross Lift', 'Cross-court lift return sending the shuttle high to the opponent''s rear corner', 'Service Return', 'badminton', NULL),

  -- Forehand (19 drills)
  ('Cross Drop FH', 'Forehand cross-court drop shot angled sharply to land near the opposite net corner', 'Forehand (FH)', 'badminton', NULL),
  ('Straight Drop FH', 'Forehand straight drop shot played gently to fall just over the net on the same side', 'Forehand (FH)', 'badminton', NULL),
  ('Straight Smash FH', 'Powerful downward forehand smash directed straight at the opponent', 'Forehand (FH)', 'badminton', NULL),
  ('Cross Smash FH', 'Aggressive forehand smash angled cross-court for maximum court coverage', 'Forehand (FH)', 'badminton', NULL),
  ('Straight Drive FH', 'Flat forehand drive hit straight and fast at mid-body height', 'Forehand (FH)', 'badminton', NULL),
  ('Cross Drive FH', 'Flat forehand drive directed cross-court with pace and minimal arc', 'Forehand (FH)', 'badminton', NULL),
  ('Reverse Slice Straight FH', 'Forehand reverse slice drop hit straight with an inverted racket face for deception', 'Forehand (FH)', 'badminton', NULL),
  ('Forward Slice Straight FH', 'Forehand forward slice drop played straight using a cutting motion for a tumbling shuttle', 'Forehand (FH)', 'badminton', NULL),
  ('Forward Slice Cross FH', 'Forehand forward slice directed cross-court with spin to create a deceptive trajectory', 'Forehand (FH)', 'badminton', NULL),
  ('Straight Defence FH', 'Forehand defensive block or lift played straight to neutralize a smash', 'Forehand (FH)', 'badminton', NULL),
  ('Cross Defence FH', 'Forehand defensive return directed cross-court to counter an attacking shot', 'Forehand (FH)', 'badminton', NULL),
  ('Straight Keep FH', 'Forehand net shot keeping the shuttle tight and straight on the same side', 'Forehand (FH)', 'badminton', NULL),
  ('Cross Keep FH', 'Forehand net shot played cross-court to redirect the rally at the net', 'Forehand (FH)', 'badminton', NULL),
  ('Lift Straight FH', 'Forehand underarm lift hit straight to the back court for defensive recovery', 'Forehand (FH)', 'badminton', NULL),
  ('Lift Cross FH', 'Forehand underarm lift directed cross-court deep into the opponent''s rear corner', 'Forehand (FH)', 'badminton', NULL),
  ('Toss Straight FH', 'Forehand toss played straight from the net to push the opponent back', 'Forehand (FH)', 'badminton', NULL),
  ('Toss Cross FH', 'Forehand toss directed cross-court from the net area to move the opponent laterally', 'Forehand (FH)', 'badminton', NULL),
  ('Dribble Keep I/O FH (Inward)', 'Forehand inward dribble net shot with a tumbling action to keep the shuttle close to the net', 'Forehand (FH)', 'badminton', NULL),
  ('Dribble Keep I/O FH (Outward)', 'Forehand outward dribble net shot spinning the shuttle away from the opponent at the net', 'Forehand (FH)', 'badminton', NULL),

  -- Round Head (9 drills)
  ('Cross Drop Round Head', 'Round head cross-court drop shot played from the backhand corner using a forehand grip', 'Round Head', 'badminton', NULL),
  ('Straight Drop Round Head', 'Round head straight drop shot played on the backhand side with a forehand overhead action', 'Round Head', 'badminton', NULL),
  ('Straight Smash Round Head', 'Powerful round head smash hit straight from the backhand rear court', 'Round Head', 'badminton', NULL),
  ('Cross Smash Round Head', 'Round head cross-court smash creating a steep angle from the backhand side', 'Round Head', 'badminton', NULL),
  ('Straight Drive Round Head', 'Flat round head drive hit straight with pace from the backhand area', 'Round Head', 'badminton', NULL),
  ('Cross Drive Round Head', 'Round head flat drive directed cross-court from behind the backhand side', 'Round Head', 'badminton', NULL),
  ('Reverse Slice Straight Round Head', 'Round head reverse slice played straight with deceptive wrist rotation', 'Round Head', 'badminton', NULL),
  ('Forward Slice Straight Round Head', 'Round head forward slice drop played straight with a cutting motion', 'Round Head', 'badminton', NULL),
  ('Reverse Slice Cross Round Head', 'Round head reverse slice directed cross-court with spin for maximum deception', 'Round Head', 'badminton', NULL),

  -- Backhand (14 drills)
  ('Straight Defence BH', 'Backhand defensive block or lift played straight to counter a smash attack', 'Backhand (BH)', 'badminton', NULL),
  ('Cross Defence BH', 'Backhand defensive return directed cross-court to neutralize an opponent''s smash', 'Backhand (BH)', 'badminton', NULL),
  ('Straight Keep BH', 'Backhand net shot keeping the shuttle tight and low on the same side', 'Backhand (BH)', 'badminton', NULL),
  ('Cross Keep BH', 'Backhand net shot played cross-court to redirect the shuttle at the net', 'Backhand (BH)', 'badminton', NULL),
  ('Lift Straight BH', 'Backhand underarm lift hit straight to the rear court for recovery', 'Backhand (BH)', 'badminton', NULL),
  ('Lift Cross BH', 'Backhand underarm lift directed cross-court deep to the opponent''s back corner', 'Backhand (BH)', 'badminton', NULL),
  ('Toss Straight BH', 'Backhand toss played straight from the net to push the opponent to the rear court', 'Backhand (BH)', 'badminton', NULL),
  ('Toss Cross BH', 'Backhand toss directed cross-court from the net to move the opponent laterally', 'Backhand (BH)', 'badminton', NULL),
  ('Dribble Keep I/O BH (Inward)', 'Backhand inward dribble net shot with a tumbling action close to the net tape', 'Backhand (BH)', 'badminton', NULL),
  ('Dribble Keep I/O BH (Outward)', 'Backhand outward dribble net shot spinning the shuttle away from the opponent', 'Backhand (BH)', 'badminton', NULL),
  ('Backhand Straight Toss', 'Overhead backhand toss hit straight to send the shuttle deep behind the opponent', 'Backhand (BH)', 'badminton', NULL),
  ('Backhand Straight Drop', 'Overhead backhand drop shot played straight to fall just over the net', 'Backhand (BH)', 'badminton', NULL),
  ('Backhand Cross Drop', 'Overhead backhand drop shot directed cross-court with a gentle touch', 'Backhand (BH)', 'badminton', NULL),
  ('Backhand Cross Toss', 'Overhead backhand toss directed cross-court to the opponent''s rear corner', 'Backhand (BH)', 'badminton', NULL);

-- Summary: 54 badminton drills seeded as global marketplace drills
-- Categories: Service (5), Service Return (6), Forehand (19), Round Head (9), Backhand (14)
