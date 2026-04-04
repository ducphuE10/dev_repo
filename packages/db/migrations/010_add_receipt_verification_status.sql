ALTER TABLE posts
ADD COLUMN IF NOT EXISTS receipt_verification_status VARCHAR(20) NOT NULL DEFAULT 'not_submitted'
  CHECK (receipt_verification_status IN ('not_submitted', 'pending', 'verified', 'failed'));

UPDATE posts
SET receipt_verification_status = CASE
  WHEN is_verified_buy = TRUE THEN 'verified'
  WHEN receipt_url IS NOT NULL THEN 'pending'
  ELSE 'not_submitted'
END
WHERE receipt_verification_status NOT IN ('not_submitted', 'pending', 'verified', 'failed')
   OR receipt_verification_status IS NULL
   OR (
     receipt_verification_status = 'not_submitted'
     AND (is_verified_buy = TRUE OR receipt_url IS NOT NULL)
   );
