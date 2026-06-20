-- Add Odia translation column
ALTER TABLE checklist_items ADD COLUMN item_text_or TEXT;

-- ETP (18)
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ପ୍ରବେଶ ନିୟନ୍ତ୍ରିତ ହେଉଛି' WHERE checkpoint_id=18 AND item_text='Area access controlled';
UPDATE checklist_items SET item_text_or='ସୁରକ୍ଷା ସୂଚନା ବୋର୍ଡ ଯଥାସ୍ଥାନରେ ଅଛି' WHERE checkpoint_id=18 AND item_text='Safety signage in place';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ସୁରକ୍ଷା ଉପକରଣ ଠିକ ଅଛି' WHERE checkpoint_id=18 AND item_text='Fire point equipment intact';
UPDATE checklist_items SET item_text_or='ଡ୍ରେନେଜ୍ ସଫା ଓ ସ୍ୱଚ୍ଛ ଅଛି' WHERE checkpoint_id=18 AND item_text='Drainage clear and clean';
UPDATE checklist_items SET item_text_or='ଟ୍ରିଟମେଣ୍ଟ ୟୁନିଟ୍ ସାଧାରଣ ଭାବେ କାର୍ଯ୍ୟ କରୁଛି' WHERE checkpoint_id=18 AND item_text='Treatment units operating normally';
UPDATE checklist_items SET item_text_or='କୌଣସି ଏଫ୍ଲୁଏଣ୍ଟ ଓଭରଫ୍ଲୋ ଦେଖାଯାଉ ନାହିଁ' WHERE checkpoint_id=18 AND item_text='No visible effluent overflow';
UPDATE checklist_items SET item_text_or='ଆବର୍ଜନା ଜମା ହୋଇ ନାହିଁ' WHERE checkpoint_id=18 AND item_text='No waste accumulation';

-- Veg Oil Yard (19)
UPDATE checklist_items SET item_text_or='ପ୍ରବେଶ ଗେଟ୍ ତାଲା/ଗାର୍ଡ ସହିତ ଅଛି' WHERE checkpoint_id=19 AND item_text='Access gates locked / guarded';
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳରେ କୌଣସି ଅନଧିକୃତ ବ୍ୟକ୍ତି ନାହାନ୍ତି' WHERE checkpoint_id=19 AND item_text='No unauthorized personnel in area';
UPDATE checklist_items SET item_text_or='PPE ପାଳନ ଦେଖାଗଲା' WHERE checkpoint_id=19 AND item_text='PPE compliance observed';
UPDATE checklist_items SET item_text_or='କୌଣସି ଖସିବା/ଝୁଣ୍ଟିବା ବିପଦ ଦେଖାଯାଉ ନାହିଁ' WHERE checkpoint_id=19 AND item_text='No slip/trip hazards visible';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ନିର୍ବାପକ ଉପଲବ୍ଧ ଓ ଚାର୍ଜ୍ ହୋଇଛି' WHERE checkpoint_id=19 AND item_text='Fire extinguisher accessible and charged';
UPDATE checklist_items SET item_text_or='ଜ୍ୱଳନ ସ୍ରୋତ ନିକଟରେ କୌଣସି ଜ୍ୱଳନଶୀଳ ସାମଗ୍ରୀ ନାହିଁ' WHERE checkpoint_id=19 AND item_text='No combustible material near ignition sources';
UPDATE checklist_items SET item_text_or='କୌଣସି ତେଲ ଛିଟିକା ଦେଖାଯାଉ ନାହିଁ' WHERE checkpoint_id=19 AND item_text='No visible oil spillage';
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ସଫା ଓ ସୁବ୍ୟବସ୍ଥିତ ଅଛି' WHERE checkpoint_id=19 AND item_text='Area clean and tidy';
UPDATE checklist_items SET item_text_or='ଷ୍ଟୋରେଜ୍ ଟାଙ୍କି ଲେଭେଲ୍ ଗେଜ୍ ପଠନୀୟ ଅଛି' WHERE checkpoint_id=19 AND item_text='Storage tank level gauges readable';
UPDATE checklist_items SET item_text_or='ବଣ୍ଡ ୱାଲ୍ ଠିକ ଓ ସଫା ଅଛି' WHERE checkpoint_id=19 AND item_text='Bund wall intact and clean';

-- LPG Yard (20)
UPDATE checklist_items SET item_text_or='ପ୍ରବେଶ ଗେଟ୍ ତାଲା/ଗାର୍ଡ ସହିତ ଅଛି' WHERE checkpoint_id=20 AND item_text='Access gates locked / guarded';
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳରେ କୌଣସି ଅନଧିକୃତ ବ୍ୟକ୍ତି ନାହାନ୍ତି' WHERE checkpoint_id=20 AND item_text='No unauthorized personnel in area';
UPDATE checklist_items SET item_text_or='PPE ପାଳନ ଦେଖାଗଲା' WHERE checkpoint_id=20 AND item_text='PPE compliance observed';
UPDATE checklist_items SET item_text_or='କୌଣସି ଖସିବା/ଝୁଣ୍ଟିବା ବିପଦ ଦେଖାଯାଉ ନାହିଁ' WHERE checkpoint_id=20 AND item_text='No slip/trip hazards visible';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ନିର୍ବାପକ ଉପଲବ୍ଧ ଓ ଚାର୍ଜ୍ ହୋଇଛି' WHERE checkpoint_id=20 AND item_text='Fire extinguisher accessible and charged';
UPDATE checklist_items SET item_text_or='ଜ୍ୱଳନ ସ୍ରୋତ ନିକଟରେ କୌଣସି ଜ୍ୱଳନଶୀଳ ସାମଗ୍ରୀ ନାହିଁ' WHERE checkpoint_id=20 AND item_text='No combustible material near ignition sources';
UPDATE checklist_items SET item_text_or='କୌଣସି ଗ୍ୟାସ୍ ଗନ୍ଧ ମିଳୁ ନାହିଁ' WHERE checkpoint_id=20 AND item_text='No gas odour detected';
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ସଫା ଓ ସୁବ୍ୟବସ୍ଥିତ ଅଛି' WHERE checkpoint_id=20 AND item_text='Area clean and tidy';
UPDATE checklist_items SET item_text_or='LPG ପାତ୍ର ଚାପ ସୁରକ୍ଷିତ ସୀମା ମଧ୍ୟରେ ଅଛି' WHERE checkpoint_id=20 AND item_text='LPG vessel pressure within safe range';
UPDATE checklist_items SET item_text_or='ଗ୍ୟାସ୍ ଲିକ୍ ଡିଟେକ୍ଟର୍ କାର୍ଯ୍ୟକ୍ଷମ ଅଛି' WHERE checkpoint_id=20 AND item_text='Gas leak detector operational';
UPDATE checklist_items SET item_text_or='ଫୋମ୍ ସିଷ୍ଟମ୍ ସକ୍ରିୟ ହେବାକୁ ପ୍ରସ୍ତୁତ ଅଛି' WHERE checkpoint_id=20 AND item_text='Foam system ready for activation';

-- Loading Point (21)
UPDATE checklist_items SET item_text_or='ପ୍ରବେଶ ଗେଟ୍ ତାଲା/ଗାର୍ଡ ସହିତ ଅଛି' WHERE checkpoint_id=21 AND item_text='Access gates locked / guarded';
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳରେ କୌଣସି ଅନଧିକୃତ ବ୍ୟକ୍ତି ନାହାନ୍ତି' WHERE checkpoint_id=21 AND item_text='No unauthorized personnel in area';
UPDATE checklist_items SET item_text_or='PPE ପାଳନ ଦେଖାଗଲା' WHERE checkpoint_id=21 AND item_text='PPE compliance observed';
UPDATE checklist_items SET item_text_or='କୌଣସି ଖସିବା/ଝୁଣ୍ଟିବା ବିପଦ ଦେଖାଯାଉ ନାହିଁ' WHERE checkpoint_id=21 AND item_text='No slip/trip hazards visible';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ନିର୍ବାପକ ଉପଲବ୍ଧ ଓ ଚାର୍ଜ୍ ହୋଇଛି' WHERE checkpoint_id=21 AND item_text='Fire extinguisher accessible and charged';
UPDATE checklist_items SET item_text_or='ଜ୍ୱଳନ ସ୍ରୋତ ନିକଟରେ କୌଣସି ଜ୍ୱଳନଶୀଳ ସାମଗ୍ରୀ ନାହିଁ' WHERE checkpoint_id=21 AND item_text='No combustible material near ignition sources';
UPDATE checklist_items SET item_text_or='କୌଣସି ଛିଟିକା ଦେଖାଯାଉ ନାହିଁ' WHERE checkpoint_id=21 AND item_text='No visible spillage';
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ସଫା ଓ ସୁବ୍ୟବସ୍ଥିତ ଅଛି' WHERE checkpoint_id=21 AND item_text='Area clean and tidy';
UPDATE checklist_items SET item_text_or='ଯାନ ଲଗ୍ ରେଜିଷ୍ଟର୍ ଅପଡେଟ୍ ହୋଇଛି' WHERE checkpoint_id=21 AND item_text='Vehicle log register updated';
UPDATE checklist_items SET item_text_or='ଲୋଡିଂ ଡକ୍ୟୁମେଣ୍ଟେସନ୍ ଯାଞ୍ଚ ହୋଇଛି' WHERE checkpoint_id=21 AND item_text='Loading documentation verified';

-- Sub Station (22)
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ପ୍ରବେଶ ନିୟନ୍ତ୍ରିତ ହେଉଛି' WHERE checkpoint_id=22 AND item_text='Area access controlled';
UPDATE checklist_items SET item_text_or='ସୁରକ୍ଷା ସୂଚନା ବୋର୍ଡ ଯଥାସ୍ଥାନରେ ଅଛି' WHERE checkpoint_id=22 AND item_text='Safety signage in place';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ସୁରକ୍ଷା ଉପକରଣ ଠିକ ଅଛି' WHERE checkpoint_id=22 AND item_text='Fire point equipment intact';
UPDATE checklist_items SET item_text_or='ଡ୍ରେନେଜ୍ ସଫା ଓ ସ୍ୱଚ୍ଛ ଅଛି' WHERE checkpoint_id=22 AND item_text='Drainage clear and clean';
UPDATE checklist_items SET item_text_or='ଉପକରଣରୁ କୌଣସି ଅସ୍ୱାଭାବିକ ଶବ୍ଦ କିମ୍ବା ଅଧିକ ଗରମ ହେଉ ନାହିଁ' WHERE checkpoint_id=22 AND item_text='No abnormal sounds or overheating from equipment';
UPDATE checklist_items SET item_text_or='ଆବର୍ଜନା ଜମା ହୋଇ ନାହିଁ' WHERE checkpoint_id=22 AND item_text='No waste accumulation';

-- Scrap Yard (23)
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ପ୍ରବେଶ ନିୟନ୍ତ୍ରିତ ହେଉଛି' WHERE checkpoint_id=23 AND item_text='Area access controlled';
UPDATE checklist_items SET item_text_or='ସୁରକ୍ଷା ସୂଚନା ବୋର୍ଡ ଯଥାସ୍ଥାନରେ ଅଛି' WHERE checkpoint_id=23 AND item_text='Safety signage in place';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ସୁରକ୍ଷା ଉପକରଣ ଠିକ ଅଛି' WHERE checkpoint_id=23 AND item_text='Fire point equipment intact';
UPDATE checklist_items SET item_text_or='ଡ୍ରେନେଜ୍ ସଫା ଓ ସ୍ୱଚ୍ଛ ଅଛି' WHERE checkpoint_id=23 AND item_text='Drainage clear and clean';
UPDATE checklist_items SET item_text_or='ଆବର୍ଜନା ଜମା ହୋଇ ନାହିଁ' WHERE checkpoint_id=23 AND item_text='No waste accumulation';
UPDATE checklist_items SET item_text_or='ସ୍କ୍ରାପ୍ ପୃଥକ ଓ ଠିକ ଭାବେ ଗଦା କରାଯାଇଛି' WHERE checkpoint_id=23 AND item_text='Scrap segregated and stacked properly';

-- Process Entrance (24)
UPDATE checklist_items SET item_text_or='ପ୍ରବେଶ କେବଳ ଅଧିକୃତ କର୍ମଚାରୀଙ୍କ ପାଇଁ ସୀମିତ' WHERE checkpoint_id=24 AND item_text='Entry restricted to authorised personnel only';
UPDATE checklist_items SET item_text_or='ଆକ୍ସେସ୍ କଣ୍ଟ୍ରୋଲ୍ ବାରିଅର୍/ଗେଟ୍ କାର୍ଯ୍ୟକ୍ଷମ ଅଛି' WHERE checkpoint_id=24 AND item_text='Access control barrier/gate operational';
UPDATE checklist_items SET item_text_or='ସମସ୍ତ କର୍ମଚାରୀ ବାଧ୍ୟତାମୂଳକ PPE ପିନ୍ଧିଛନ୍ତି' WHERE checkpoint_id=24 AND item_text='All personnel wearing mandatory PPE';
UPDATE checklist_items SET item_text_or='କାର୍ଯ୍ୟ ଅନୁମତି ବୋର୍ଡ ଅପଡେଟ୍ ଓ ଦୃଶ୍ୟମାନ ଅଛି' WHERE checkpoint_id=24 AND item_text='Work permit board updated and visible';
UPDATE checklist_items SET item_text_or='ପ୍ରବେଶ ନିକଟରେ ଧୂମପାନ କିମ୍ବା ଖୋଲା ନିଆଁ ନାହିଁ' WHERE checkpoint_id=24 AND item_text='No smoking or open flame near entrance';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ନିର୍ବାପକ ଉପଲବ୍ଧ ଓ ଚାର୍ଜ୍ ହୋଇଛି' WHERE checkpoint_id=24 AND item_text='Fire extinguisher accessible and charged';
UPDATE checklist_items SET item_text_or='ଜରୁରୀକାଳୀନ ନିର୍ଗମନ ପଥ ସଫା ଓ ଅବାଧ ଅଛି' WHERE checkpoint_id=24 AND item_text='Emergency evacuation route clear and unobstructed';
UPDATE checklist_items SET item_text_or='ପ୍ରବେଶ ସ୍ଥାନରେ କୌଣସି ତେଲ କିମ୍ବା ରାସାୟନିକ ଛିଟିକା ନାହିଁ' WHERE checkpoint_id=24 AND item_text='No oil or chemical spillage at entrance';
UPDATE checklist_items SET item_text_or='ପ୍ରବେଶ ଅଞ୍ଚଳ ସଫା ଓ ବାଧାମୁକ୍ତ ଅଛି' WHERE checkpoint_id=24 AND item_text='Entrance area clean and free of obstructions';
UPDATE checklist_items SET item_text_or='CCTV କ୍ୟାମେରା କାର୍ଯ୍ୟକ୍ଷମ ଅଛି' WHERE checkpoint_id=24 AND item_text='CCTV cameras operational';
UPDATE checklist_items SET item_text_or='ସୁରକ୍ଷା ଇଣ୍ଡକ୍ସନ୍ ବୋର୍ଡ/ସୂଚନା ଦୃଶ୍ୟମାନ ଓ ଅପଡେଟ୍ ଅଛି' WHERE checkpoint_id=24 AND item_text='Safety induction board/signage visible and updated';

-- RM Area (25)
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ପ୍ରବେଶ ନିୟନ୍ତ୍ରିତ ହେଉଛି' WHERE checkpoint_id=25 AND item_text='Area access controlled';
UPDATE checklist_items SET item_text_or='ସୁରକ୍ଷା ସୂଚନା ବୋର୍ଡ ଯଥାସ୍ଥାନରେ ଅଛି' WHERE checkpoint_id=25 AND item_text='Safety signage in place';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ସୁରକ୍ଷା ଉପକରଣ ଠିକ ଅଛି' WHERE checkpoint_id=25 AND item_text='Fire point equipment intact';
UPDATE checklist_items SET item_text_or='ଡ୍ରେନେଜ୍ ସଫା ଓ ସ୍ୱଚ୍ଛ ଅଛି' WHERE checkpoint_id=25 AND item_text='Drainage clear and clean';
UPDATE checklist_items SET item_text_or='ଆବର୍ଜନା ଜମା ହୋଇ ନାହିଁ' WHERE checkpoint_id=25 AND item_text='No waste accumulation';
UPDATE checklist_items SET item_text_or='କଞ୍ଚାମାଲ ଠିକ ଭାବେ ଗଦା ଓ ସଂରକ୍ଷିତ ଅଛି' WHERE checkpoint_id=25 AND item_text='Raw material stacked and stored properly';

-- Scrap/Dumping Area (26)
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ପ୍ରବେଶ ନିୟନ୍ତ୍ରିତ ହେଉଛି' WHERE checkpoint_id=26 AND item_text='Area access controlled';
UPDATE checklist_items SET item_text_or='ସୁରକ୍ଷା ସୂଚନା ବୋର୍ଡ ଯଥାସ୍ଥାନରେ ଅଛି' WHERE checkpoint_id=26 AND item_text='Safety signage in place';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ସୁରକ୍ଷା ଉପକରଣ ଠିକ ଅଛି' WHERE checkpoint_id=26 AND item_text='Fire point equipment intact';
UPDATE checklist_items SET item_text_or='ଡ୍ରେନେଜ୍ ସଫା ଓ ସ୍ୱଚ୍ଛ ଅଛି' WHERE checkpoint_id=26 AND item_text='Drainage clear and clean';
UPDATE checklist_items SET item_text_or='ଆବର୍ଜନା ପୃଥକୀକରଣ ପାଳନ କରାଯାଉଛି' WHERE checkpoint_id=26 AND item_text='Waste segregation followed';
UPDATE checklist_items SET item_text_or='ଆବର୍ଜନା ଜମା ହୋଇ ନାହିଁ' WHERE checkpoint_id=26 AND item_text='No waste accumulation';

-- Biscuit Area/Store (27)
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ପ୍ରବେଶ ନିୟନ୍ତ୍ରିତ ହେଉଛି' WHERE checkpoint_id=27 AND item_text='Area access controlled';
UPDATE checklist_items SET item_text_or='ସୁରକ୍ଷା ସୂଚନା ବୋର୍ଡ ଯଥାସ୍ଥାନରେ ଅଛି' WHERE checkpoint_id=27 AND item_text='Safety signage in place';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ସୁରକ୍ଷା ଉପକରଣ ଠିକ ଅଛି' WHERE checkpoint_id=27 AND item_text='Fire point equipment intact';
UPDATE checklist_items SET item_text_or='ଡ୍ରେନେଜ୍ ସଫା ଓ ସ୍ୱଚ୍ଛ ଅଛି' WHERE checkpoint_id=27 AND item_text='Drainage clear and clean';
UPDATE checklist_items SET item_text_or='ଆବର୍ଜନା ଜମା ହୋଇ ନାହିଁ' WHERE checkpoint_id=27 AND item_text='No waste accumulation';
UPDATE checklist_items SET item_text_or='ଷ୍ଟକ୍ ସୁରକ୍ଷିତ ଭାବେ ଓ ସୀମା ମଧ୍ୟରେ ଗଦା ହୋଇଛି' WHERE checkpoint_id=27 AND item_text='Stock stacked safely and within limits';

-- FG Stock Yard (28)
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ପ୍ରବେଶ ନିୟନ୍ତ୍ରିତ ହେଉଛି' WHERE checkpoint_id=28 AND item_text='Area access controlled';
UPDATE checklist_items SET item_text_or='ସୁରକ୍ଷା ସୂଚନା ବୋର୍ଡ ଯଥାସ୍ଥାନରେ ଅଛି' WHERE checkpoint_id=28 AND item_text='Safety signage in place';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ସୁରକ୍ଷା ଉପକରଣ ଠିକ ଅଛି' WHERE checkpoint_id=28 AND item_text='Fire point equipment intact';
UPDATE checklist_items SET item_text_or='ଡ୍ରେନେଜ୍ ସଫା ଓ ସ୍ୱଚ୍ଛ ଅଛି' WHERE checkpoint_id=28 AND item_text='Drainage clear and clean';
UPDATE checklist_items SET item_text_or='ଆବର୍ଜନା ଜମା ହୋଇ ନାହିଁ' WHERE checkpoint_id=28 AND item_text='No waste accumulation';
UPDATE checklist_items SET item_text_or='ତିଆରି ସାମଗ୍ରୀ ଠିକ ଭାବେ ଗଦା ଓ ଢଙ୍କା ହୋଇଛି' WHERE checkpoint_id=28 AND item_text='Finished goods stacked and covered properly';

-- FG Dock (29)
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ପ୍ରବେଶ ନିୟନ୍ତ୍ରିତ ହେଉଛି' WHERE checkpoint_id=29 AND item_text='Area access controlled';
UPDATE checklist_items SET item_text_or='ସୁରକ୍ଷା ସୂଚନା ବୋର୍ଡ ଯଥାସ୍ଥାନରେ ଅଛି' WHERE checkpoint_id=29 AND item_text='Safety signage in place';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ସୁରକ୍ଷା ଉପକରଣ ଠିକ ଅଛି' WHERE checkpoint_id=29 AND item_text='Fire point equipment intact';
UPDATE checklist_items SET item_text_or='ଡ୍ରେନେଜ୍ ସଫା ଓ ସ୍ୱଚ୍ଛ ଅଛି' WHERE checkpoint_id=29 AND item_text='Drainage clear and clean';
UPDATE checklist_items SET item_text_or='ଆବର୍ଜନା ଜମା ହୋଇ ନାହିଁ' WHERE checkpoint_id=29 AND item_text='No waste accumulation';
UPDATE checklist_items SET item_text_or='ପ୍ରେରଣ ଡକ୍ୟୁମେଣ୍ଟେସନ୍ ଯାଞ୍ଚ ହୋଇଛି' WHERE checkpoint_id=29 AND item_text='Dispatch documentation verified';

-- PM Dock (30)
UPDATE checklist_items SET item_text_or='ଅଞ୍ଚଳ ପ୍ରବେଶ ନିୟନ୍ତ୍ରିତ ହେଉଛି' WHERE checkpoint_id=30 AND item_text='Area access controlled';
UPDATE checklist_items SET item_text_or='ସୁରକ୍ଷା ସୂଚନା ବୋର୍ଡ ଯଥାସ୍ଥାନରେ ଅଛି' WHERE checkpoint_id=30 AND item_text='Safety signage in place';
UPDATE checklist_items SET item_text_or='ଅଗ୍ନି ସୁରକ୍ଷା ଉପକରଣ ଠିକ ଅଛି' WHERE checkpoint_id=30 AND item_text='Fire point equipment intact';
UPDATE checklist_items SET item_text_or='ଡ୍ରେନେଜ୍ ସଫା ଓ ସ୍ୱଚ୍ଛ ଅଛି' WHERE checkpoint_id=30 AND item_text='Drainage clear and clean';
UPDATE checklist_items SET item_text_or='ଆବର୍ଜନା ଜମା ହୋଇ ନାହିଁ' WHERE checkpoint_id=30 AND item_text='No waste accumulation';
UPDATE checklist_items SET item_text_or='ଆସୁଥିବା ସାମଗ୍ରୀ ଡକ୍ୟୁମେଣ୍ଟେସନ୍ ଯାଞ୍ଚ ହୋଇଛି' WHERE checkpoint_id=30 AND item_text='Incoming material documentation verified';
