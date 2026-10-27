-- New guest reservations use the sharing link's canonical token hash as their owner.
-- Keep its name after revocation so family members can identify the reservation.
-- Existing browser-owned reservations stay intact: their originating link was not stored.
-- This nullable addition also allows the previously deployed Worker to keep writing.
ALTER TABLE claims ADD COLUMN share_link_name TEXT;
