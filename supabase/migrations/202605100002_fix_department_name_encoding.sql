update public.sharsh_departments
set department_name = case department_id
  when 'r4' then 'ÕŽÕ«Ö€Õ¡Õ¢Õ¸Ö‚ÕªÕ¡Õ¯Õ¡Õ¶'
  when 'r5' then 'Ô´/Ô¾ Õ¾/Õ¢ Õ¢Õ¡ÕªÕ¡Õ¶Õ´Õ¸Ö‚Õ¶Ö„'
  when 'r6' then 'Õ”Õ«Õ©-Õ¯Õ¸Õ¯Õ¸Ö€Õ¤ Õ¢-Ö„'
  when 'r7' then 'Ô±Õ¯Õ¶Õ¡Õ¢Õ¸Ö‚ÕªÕ¡Õ¯Õ¡Õ¶'
  when 'r8' then 'ÕŽÕ¶Õ¡Õ½Õ¾Õ¡Õ®Ö„Õ¡Õ¢Õ¡Õ¶Õ¡Õ¯Õ¡Õ¶'
  when 'r9' then 'Ô¿Ö€Õ®Ö„Õ¡ÕµÕ«Õ¶ Õ¾/Õ¢'
  when 'r10' then 'ÕˆÖ‚Õ¼Õ¸Õ¬Õ¸Õ£Õ«Õ¡Õ¯Õ¡Õ¶'
  when 'r11' then 'Õ†Õ¥ÕµÖ€Õ¸Õ¾Õ«Ö€Õ¡Õ¢Õ¸Ö‚ÕªÕ¡Õ¯Õ¡Õ¶'
  when 'r12' then 'Ô¹Õ¼Õ«Õ¹Ö„Õ¡ÕµÕ«Õ¶'
  when 'r13' then 'Ô¹Õ¥Ö€Õ¡ÕºÕ«Õ¡'
  when 'r14' then 'ÕŽÕ¥Ö€Õ¡Õ¯Õ¥Õ¶Õ¤Õ¡Õ¶Õ¡ÖÕ´Õ¡Õ¶'
  when 'r15' then 'Õ†ÕµÕ¡Ö€Õ¤Õ¡Õ¢Õ¡Õ¶Õ¡Õ¯Õ¡Õ¶'
  when 'r16' then 'Ô³Õ«Õ¶Õ¥Õ¯Õ¸Õ¬Õ¸Õ£Õ«Õ¡Õ¯Õ¡Õ¶'
  when 'r17' then 'Ô±Õ¶Õ¸Õ©Õ¡ÕµÕ«Õ¶'
  when 'r19' then 'Ô»Õ†Õ–'
  when 'r20' then 'Ô±ÕÔ´'
  when 'r21' then 'Õ”/Õ€'
  else department_name
end;

update public.sharsh_ocr_feedback
set department_name = case department_id
  when 'r4' then 'ÕŽÕ«Ö€Õ¡Õ¢Õ¸Ö‚ÕªÕ¡Õ¯Õ¡Õ¶'
  when 'r5' then 'Ô´/Ô¾ Õ¾/Õ¢ Õ¢Õ¡ÕªÕ¡Õ¶Õ´Õ¸Ö‚Õ¶Ö„'
  when 'r6' then 'Õ”Õ«Õ©-Õ¯Õ¸Õ¯Õ¸Ö€Õ¤ Õ¢-Ö„'
  when 'r7' then 'Ô±Õ¯Õ¶Õ¡Õ¢Õ¸Ö‚ÕªÕ¡Õ¯Õ¡Õ¶'
  when 'r8' then 'ÕŽÕ¶Õ¡Õ½Õ¾Õ¡Õ®Ö„Õ¡Õ¢Õ¡Õ¶Õ¡Õ¯Õ¡Õ¶'
  when 'r9' then 'Ô¿Ö€Õ®Ö„Õ¡ÕµÕ«Õ¶ Õ¾/Õ¢'
  when 'r10' then 'ÕˆÖ‚Õ¼Õ¸Õ¬Õ¸Õ£Õ«Õ¡Õ¯Õ¡Õ¶'
  when 'r11' then 'Õ†Õ¥ÕµÖ€Õ¸Õ¾Õ«Ö€Õ¡Õ¢Õ¸Ö‚ÕªÕ¡Õ¯Õ¡Õ¶'
  when 'r12' then 'Ô¹Õ¼Õ«Õ¹Ö„Õ¡ÕµÕ«Õ¶'
  when 'r13' then 'Ô¹Õ¥Ö€Õ¡ÕºÕ«Õ¡'
  when 'r14' then 'ÕŽÕ¥Ö€Õ¡Õ¯Õ¥Õ¶Õ¤Õ¡Õ¶Õ¡ÖÕ´Õ¡Õ¶'
  when 'r15' then 'Õ†ÕµÕ¡Ö€Õ¤Õ¡Õ¢Õ¡Õ¶Õ¡Õ¯Õ¡Õ¶'
  when 'r16' then 'Ô³Õ«Õ¶Õ¥Õ¯Õ¸Õ¬Õ¸Õ£Õ«Õ¡Õ¯Õ¡Õ¶'
  when 'r17' then 'Ô±Õ¶Õ¸Õ©Õ¡ÕµÕ«Õ¶'
  when 'r19' then 'Ô»Õ†Õ–'
  when 'r20' then 'Ô±ÕÔ´'
  when 'r21' then 'Õ”/Õ€'
  else department_name
end;
