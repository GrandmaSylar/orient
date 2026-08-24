const sql = require('mssql');
const crypto = require('crypto');

// SHA256 helper for password hashing without native binary dependencies
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function initializeDatabase(pool) {
  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    console.log('Initializing database tables...');

    // 1. Create Users Table
    await request.query(`
      if not exists (select * from sysobjects where name='users' and xtype='U')
      create table users (
        id int identity(1,1) primary key,
        username varchar(50) unique not null,
        password_hash varchar(255) not null,
        role varchar(20) not null, -- 'TELLER', 'SUPERVISOR', 'ADMIN'
        is_active bit default 1 not null,
        created_at datetime default getdate() not null
      );
    `);

    // 2. Create Academic Terms Table
    await request.query(`
      if not exists (select * from sysobjects where name='academic_terms' and xtype='U')
      create table academic_terms (
        id int identity(1,1) primary key,
        academic_year varchar(20) not null,
        term_name varchar(20) not null,
        is_active bit default 0 not null,
        created_at datetime default getdate() not null
      );
    `);

    // 3. Create Students Table
    await request.query(`
      if not exists (select * from sysobjects where name='students' and xtype='U')
      create table students (
        id int identity(1,1) primary key,
        student_id varchar(50) unique not null,
        full_name varchar(150) not null,
        dob date null,
        grade_class varchar(50) not null,
        guardian_phone varchar(20) not null,
        is_active bit default 1 not null,
        created_at datetime default getdate() not null
      );
    `);

    // Migration to ensure existing students.dob column is nullable
    await request.query(`
      if exists (select * from sys.columns where object_id = object_id('students') and name = 'dob')
      begin
        alter table students alter column dob date null;
      end
    `);

    // 4. Create Products Table
    await request.query(`
      if not exists (select * from sysobjects where name='products' and xtype='U')
      create table products (
        id int identity(1,1) primary key,
        name varchar(100) unique not null,
        description varchar(255),
        is_active bit default 1 not null,
        created_at datetime default getdate() not null
      );
    `);

    // 5. Create Transactions Table
    await request.query(`
      if not exists (select * from sysobjects where name='transactions' and xtype='U')
      create table transactions (
        id int identity(1,1) primary key,
        receipt_number varchar(50) unique not null,
        student_id int foreign key references students(id) not null,
        product_id int foreign key references products(id) not null,
        term_id int foreign key references academic_terms(id) not null,
        amount decimal(18,2) not null,
        paid_by varchar(150) not null,
        narration varchar(255),
        student_class_snapshot varchar(50) not null,
        guardian_phone_snapshot varchar(20) not null,
        status varchar(20) default 'POSTED' not null,
        void_reason varchar(255),
        voided_by int foreign key references users(id),
        voided_at datetime,
        created_by int foreign key references users(id) not null,
        created_at datetime default getdate() not null
      );
    `);

    // 6. Create Audit Logs Table
    await request.query(`
      if not exists (select * from sysobjects where name='audit_logs' and xtype='U')
      create table audit_logs (
        id int identity(1,1) primary key,
        user_id int foreign key references users(id),
        action varchar(50) not null,
        details nvarchar(max) not null,
        ip_address varchar(45),
        created_at datetime default getdate() not null
      );
    `);

    // 7. Seed Default Admin if no users exist
    const userCheck = await request.query('select count(*) as count from users');
    if (userCheck.recordset[0].count === 0) {
      console.log('Seeding default administrator accounts...');
      const adminPassHash = hashPassword('admin123'); // Default password
      const grandmaPassHash = hashPassword('Breakfast@9am'); // Grandma superadmin
      const devPassHash = hashPassword('Orient@ElectricFan!'); // Dev account
      await request.query(`
        insert into users (username, password_hash, role, is_active)
        values 
          ('admin', '${adminPassHash}', 'ADMIN', 1),
          ('grandma', '${grandmaPassHash}', 'ADMIN', 1),
          ('dev', '${devPassHash}', 'DEV', 1)
      `);
    } else {
      // If table exists but grandma is missing, seed her specifically
      const grandmaCheck = await request.query("select count(*) as count from users where username = 'grandma'");
      if (grandmaCheck.recordset[0].count === 0) {
        console.log('Seeding grandma superadmin account...');
        const grandmaPassHash = hashPassword('Breakfast@9am');
        await request.query(`
          insert into users (username, password_hash, role, is_active)
          values ('grandma', '${grandmaPassHash}', 'ADMIN', 1)
        `);
      }

      // If dev is missing, seed it specifically
      const devCheck = await request.query("select count(*) as count from users where username = 'dev'");
      if (devCheck.recordset[0].count === 0) {
        console.log('Seeding developer account...');
        const devPassHash = hashPassword('Orient@ElectricFan!');
        await request.query(`
          insert into users (username, password_hash, role, is_active)
          values ('dev', '${devPassHash}', 'DEV', 1)
        `);
      }
    }

    // 8. Seed Default Term if none exist
    const termCheck = await request.query('select count(*) as count from academic_terms');
    if (termCheck.recordset[0].count === 0) {
      console.log('Seeding default academic term...');
      await request.query(`
        insert into academic_terms (academic_year, term_name, is_active)
        values ('2025/2026', 'Term 1', 1)
      `);
    }

    // 9. Create Org Config Table
    await request.query(`
      if not exists (select * from sysobjects where name='org_config' and xtype='U')
      begin
        create table org_config (
          id int primary key default 1 check (id = 1),
          org_name varchar(150) default 'GRACE BAPTIST CREDIT UNION' not null,
          location varchar(150) default 'AMAKOM-KUMASI' not null,
          telephone varchar(100) default 'TEL: 0244757447/0207447016' not null,
          school_name varchar(150) default 'Space Academy' not null,
          logo_url varchar(max) null
        );
        insert into org_config (org_name, location, telephone, school_name)
        values ('GRACE BAPTIST CREDIT UNION', 'AMAKOM-KUMASI', 'TEL: 0244757447/0207447016', 'Space Academy');
      end
    `);

    await transaction.commit();
    console.log('Database initialization completed successfully.');
    return { success: true };
  } catch (err) {
    await transaction.rollback();
    console.error('Database initialization failed, transaction rolled back:', err);
    throw err;
  }
}

module.exports = {
  initializeDatabase,
  hashPassword
};
