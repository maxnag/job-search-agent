UPDATE "vacancies" SET "vacancy_dedup_country" = coalesce("vacancy_country", '') WHERE "vacancy_dedup_country" = '';
