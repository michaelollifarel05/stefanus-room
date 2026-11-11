# Desain database St Stefanus

Schema penuh tetap sama dengan project awal. Sumber yang dieksekusi adalah `migrations/001_initial.sql`; dokumen ini hanya panduan presentasi, bukan migration tambahan.

```mermaid
erDiagram
    organizations o|--o{ users : "organization_id (nullable)"
    organizations ||--o{ bookings : organization_id
    rooms ||--o{ bookings : room_id
    users ||--o{ bookings : requester_id
    users o|--o{ bookings : "decided_by (nullable)"
    users o|--o{ audit_logs : "actor_id (nullable)"
    organizations {
        uuid id PK
        text name UK
        boolean active
    }
    users {
        uuid id PK
        text name
        text email UK
        text password_hash
        text role
        uuid organization_id FK
        boolean active
        timestamptz created_at
    }
    rooms {
        uuid id PK
        text name UK
        integer capacity
        text location
        text facilities
        boolean active
    }
    bookings {
        uuid id PK
        uuid room_id FK
        uuid organization_id FK
        uuid requester_id FK
        text title
        text purpose
        integer attendees
        timestamptz starts_at
        timestamptz ends_at
        text status
        text decision_reason
        uuid decided_by FK
        timestamptz decided_at
        timestamptz created_at
        timestamptz updated_at
    }
    audit_logs {
        bigint id PK
        uuid actor_id FK
        text action
        text entity_type
        uuid entity_id
        jsonb details
        timestamptz created_at
    }
```

## Yang dipakai pada tahap login

- `users.email`: unik dan lowercase; dipakai untuk menemukan akun aktif.
- `users.password_hash`: salt dan hash scrypt; password asli tidak disimpan.
- `users.active`: user nonaktif tidak bisa login; token yang sudah terbit juga ditolak saat mengecek profil.
- `users.role`: ADMIN, SECRETARIAT, atau MEMBER. Role tersimpan untuk tahap otorisasi berikutnya.
- `users.organization_id`: relasi opsional ke organisasi. Data organisasi tetap tersedia untuk pengembangan berikutnya.

Saat login, query mencari email dengan `active = true`. Verifikasi hash dilakukan di Node.js. JWT berisi identitas `sub`, waktu terbit/kedaluwarsa, issuer dan audience; role dan status aktif dibaca lagi dari database pada request terproteksi. Response profil tidak menyertakan password hash.

## Desain untuk tahap berikutnya

- `rooms`: kapasitas harus positif; nama unik; ruangan bisa dinonaktifkan.
- `bookings`: relasi requester, organisasi, dan ruangan. Keputusan dapat mencatat user yang memutuskan serta alasannya.
- Status booking dibatasi ke PENDING, APPROVED, REJECTED, CANCELLED. Waktu akhir harus setelah waktu awal; attendee count positif.
- Constraint GiST `no_room_overlap` dengan extension `btree_gist` mencegah overlap untuk booking PENDING/APPROVED. Rentang `[start,end)` memperbolehkan jadwal yang berdampingan.
- `audit_logs`: aktor, aksi, entity, detail JSON, dan timestamp. `entity_id` adalah referensi generik aplikasi, **bukan foreign key** ke satu tabel tertentu. Tahap login ini belum menulis audit log login.
- `schema_migrations`: tabel teknis tambahan yang dibuat script migrasi untuk mencatat file SQL yang sudah diterapkan, bukan entity bisnis.

## Melihat tabel saat presentasi

```powershell
docker compose exec db psql -U booking -d booking -c "\dt"
docker compose exec db psql -U booking -d booking -c "\d users"
docker compose exec db psql -U booking -d booking -c "\d bookings"
docker compose exec db psql -U booking -d booking -c "SELECT id,name,email,role,active FROM users;"
```

Bisa juga memakai pgAdmin/DBeaver: host `localhost`, port `5434`, database `booking`, user `booking`, password lokal default `booking_local_only`.
