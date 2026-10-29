require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function seedRoles() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    if (!process.env.DEMO_PASSWORD) {
      throw new Error('Falta DEMO_PASSWORD en el archivo .env');
    }
    const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD, 12);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const rolesCol = db.collection('roles');
    const credencialesCol = db.collection('credenciales');

    const defaultUsers = [
      {
        auth_uid: 'uid-rep-001',
        nombre_usuario: 'laura.mendez',
        correo: 'laura.mendez@utm.edu.mx',
        primer_nombre: 'Laura',
        apellido_paterno: 'Mendez',
        rol: 'reportante',
        perfil: 'docente',
        activo: true,
        fecha_creacion: new Date()
      },
      {
        auth_uid: 'uid-tec-001',
        nombre_usuario: 'carlos.ruiz',
        correo: 'carlos.ruiz@utm.edu.mx',
        primer_nombre: 'Carlos',
        apellido_paterno: 'Ruiz',
        rol: 'tecnico',
        activo: true,
        fecha_creacion: new Date()
      },
      {
        auth_uid: 'uid-tec-002',
        nombre_usuario: 'ana.torres',
        correo: 'ana.torres@utm.edu.mx',
        primer_nombre: 'Ana',
        apellido_paterno: 'Torres',
        rol: 'tecnico',
        activo: true,
        fecha_creacion: new Date()
      },
      {
        auth_uid: 'uid-tec-003',
        nombre_usuario: 'jorge.pech',
        correo: 'jorge.pech@utm.edu.mx',
        primer_nombre: 'Jorge',
        apellido_paterno: 'Pech',
        rol: 'tecnico',
        activo: false,
        fecha_creacion: new Date()
      },
      {
        auth_uid: 'uid-coor-001',
        nombre_usuario: 'mariana.chi',
        correo: 'mariana.chi@utm.edu.mx',
        primer_nombre: 'Mariana',
        apellido_paterno: 'Chi',
        rol: 'coordinador',
        activo: true,
        fecha_creacion: new Date()
      },
      {
        auth_uid: 'uid-dir-001',
        nombre_usuario: 'raul.baeza',
        correo: 'raul.baeza@utm.edu.mx',
        primer_nombre: 'Raul',
        apellido_paterno: 'Baeza',
        rol: 'directivo',
        activo: true,
        fecha_creacion: new Date()
      },
      {
        auth_uid: 'uid-admin-001',
        nombre_usuario: 'daniel.flota',
        correo: 'daniel.flota@utm.edu.mx',
        primer_nombre: 'Daniel',
        apellido_paterno: 'Flota',
        rol: 'administrador',
        activo: true,
        fecha_creacion: new Date()
      }
    ];

    for (const u of defaultUsers) {
      await rolesCol.updateOne(
        { correo: u.correo },
        { $set: u },
        { upsert: true }
      );
      await credencialesCol.updateOne(
        { auth_uid: u.auth_uid },
        { $set: { auth_uid: u.auth_uid, password_hash: passwordHash } },
        { upsert: true }
      );
    }

    const total = await rolesCol.countDocuments();
    console.log('✅ Roles sincronizados exitosamente. Total usuarios en roles:', total);
  } catch (err) {
    console.error('❌ Error sincronizando roles:', err);
  } finally {
    await client.close();
  }
}

seedRoles();
