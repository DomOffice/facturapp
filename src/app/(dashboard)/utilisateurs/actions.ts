'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';

export async function deleteUtilisateur(formData: FormData) {
  const id = Number(formData.get('id'));
  
  // Vérifier s'il s'agit du dernier admin
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id },
    include: { role: true },
  });
  
  if (utilisateur?.role.code === 'admin') {
    const nbAdmins = await prisma.utilisateur.count({
      where: { role: { code: 'admin' }, actif: true },
    });
    
    if (nbAdmins <= 1) {
      throw new Error('Impossible de désactiver le dernier administrateur');
    }
  }

  // Désactiver l'utilisateur
  await prisma.utilisateur.update({ 
    where: { id }, 
    data: { actif: false } 
  });

  revalidatePath('/utilisateurs');
}