update public.sharsh_departments
set department_name = case department_id
  when 'r4' then 'Վիրաբուժական'
  when 'r5' then 'Դ/Ծ վ/բ բաժանմունք'
  when 'r6' then 'Քիթ-կոկորդ բ-ք'
  when 'r7' then 'Ակնաբուժական'
  when 'r8' then 'Վնասվածքաբանական'
  when 'r9' then 'Կրծքային վ/բ'
  when 'r10' then 'Ուռոլոգիական'
  when 'r11' then 'Նեյրովիրաբուժական'
  when 'r12' then 'Թռիչքային'
  when 'r13' then 'Թերապիա'
  when 'r14' then 'Վերակենդանացման'
  when 'r15' then 'Նյարդաբանական'
  when 'r16' then 'Գինեկոլոգիական'
  when 'r17' then 'Անոթային'
  when 'r19' then 'ԻՆՖ'
  when 'r20' then 'ԱՏԴ'
  when 'r21' then 'Ք/Հ'
  else department_name
end;

update public.sharsh_ocr_feedback
set department_name = case department_id
  when 'r4' then 'Վիրաբուժական'
  when 'r5' then 'Դ/Ծ վ/բ բաժանմունք'
  when 'r6' then 'Քիթ-կոկորդ բ-ք'
  when 'r7' then 'Ակնաբուժական'
  when 'r8' then 'Վնասվածքաբանական'
  when 'r9' then 'Կրծքային վ/բ'
  when 'r10' then 'Ուռոլոգիական'
  when 'r11' then 'Նեյրովիրաբուժական'
  when 'r12' then 'Թռիչքային'
  when 'r13' then 'Թերապիա'
  when 'r14' then 'Վերակենդանացման'
  when 'r15' then 'Նյարդաբանական'
  when 'r16' then 'Գինեկոլոգիական'
  when 'r17' then 'Անոթային'
  when 'r19' then 'ԻՆՖ'
  when 'r20' then 'ԱՏԴ'
  when 'r21' then 'Ք/Հ'
  else department_name
end;
