export type SupportedLanguage = 'fr' | 'en' | 'mg';

export interface TranslationDict {
  appName: string;
  menu: {
    tasks: string;
    myTasks: string;
    wallet: string;
    withdraw: string;
    history: string;
    profile: string;
    settings: string;
    language: string;
    help: string;
    support: string;
  };
  wallet: {
    title: string;
    availableBalance: string;
    pendingWithdrawals: string;
    totalEarned: string;
    totalWithdrawn: string;
    minWithdrawalNotice: string;
    withdrawNow: string;
    noTransactions: string;
    ledgerTitle: string;
  };
  withdraw: {
    title: string;
    amount: string;
    method: string;
    destination: string;
    submit: string;
    minAmount: string;
    insufficientBalance: string;
    successNotice: string;
    selectMethod: string;
    destinationPlaceholder: string;
    pendingRequests: string;
  };
  tasks: {
    title: string;
    taskType: string;
    uid: string;
    firstName: string;
    lastName: string;
    password: string;
    cookies: string;
    submit: string;
    status: string;
    pending: string;
    validated: string;
    rejected: string;
    reward: string;
    rules: string;
    cookiesPlaceholder: string;
    uidPlaceholder: string;
    createdSuccess: string;
  };
  myTasks: {
    title: string;
    empty: string;
    date: string;
    status: string;
    reward: string;
  };
  history: {
    title: string;
    empty: string;
    type: string;
    amount: string;
    balanceAfter: string;
    date: string;
  };
  profile: {
    title: string;
    telegramId: string;
    username: string;
    name: string;
    language: string;
    stats: string;
    completedTasks: string;
    pendingTasks: string;
    rejectedTasks: string;
  };
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    confirm: string;
    back: string;
    retry: string;
  };
  help: {
    title: string;
    subtitle: string;
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    contactSupport: string;
  };
}

export const translations: Record<SupportedLanguage, TranslationDict> = {
  fr: {
    appName: 'Taskify Pro',
    menu: {
      tasks: 'Tâches',
      myTasks: 'Mes Tâches',
      wallet: 'Portefeuille',
      withdraw: 'Retrait',
      history: 'Historique',
      profile: 'Profil',
      settings: 'Paramètres',
      language: 'Langue',
      help: 'Aide & Règles',
      support: 'Support'
    },
    wallet: {
      title: 'Mon Portefeuille',
      availableBalance: 'Solde disponible',
      pendingWithdrawals: 'En attente de paiement',
      totalEarned: 'Total gagné',
      totalWithdrawn: 'Total retiré',
      minWithdrawalNotice: 'Seuil minimum de retrait : $1.00 USD',
      withdrawNow: 'Demander un retrait',
      noTransactions: 'Aucune transaction enregistrée',
      ledgerTitle: 'Livre de comptes (Ledger)'
    },
    withdraw: {
      title: 'Demande de Retrait',
      amount: 'Montant ($ USD)',
      method: 'Moyen de paiement',
      destination: 'Numéro / Compte de réception',
      submit: 'Confirmer la demande',
      minAmount: 'Le montant minimum est de $1.00 USD',
      insufficientBalance: 'Solde disponible insuffisant',
      successNotice: 'Demande de retrait enregistrée avec succès !',
      selectMethod: 'Sélectionner un moyen de paiement',
      destinationPlaceholder: 'Ex: 034 00 000 00 ou email PayPal ou IBAN',
      pendingRequests: 'Demandes en cours'
    },
    tasks: {
      title: 'Nouvelle Tâche',
      taskType: 'Type de tâche',
      uid: 'UID du compte',
      firstName: 'Prénom généré',
      lastName: 'Nom généré',
      password: 'Mot de passe imposé',
      cookies: 'Cookies complets',
      submit: 'Soumettre la tâche',
      status: 'Statut',
      pending: 'En attente de validation',
      validated: 'Validé & Rémunéré',
      rejected: 'Rejeté',
      reward: 'Rémunération par tâche : $0.04 USD',
      rules: 'Règles de conformité',
      cookiesPlaceholder: 'Collez les cookies complets (ex: datr=...; c_user=...; xs=...)',
      uidPlaceholder: 'Ex: 100084928172910',
      createdSuccess: 'Tâche transmise avec succès ! Elle sera vérifiée par un administrateur.'
    },
    myTasks: {
      title: 'Mes Tâches Réalisées',
      empty: 'Vous n\'avez encore soumis aucune tâche.',
      date: 'Date de soumission',
      status: 'Statut de validation',
      reward: 'Gain'
    },
    history: {
      title: 'Historique des Transactions',
      empty: 'Aucune transaction pour le moment.',
      type: 'Type',
      amount: 'Montant',
      balanceAfter: 'Solde restant',
      date: 'Date'
    },
    profile: {
      title: 'Profil Utilisateur',
      telegramId: 'ID Telegram',
      username: 'Nom d\'utilisateur',
      name: 'Nom complet',
      language: 'Langue de l\'interface',
      stats: 'Statistiques globales',
      completedTasks: 'Tâches validées',
      pendingTasks: 'Tâches en attente',
      rejectedTasks: 'Tâches refusées'
    },
    common: {
      loading: 'Chargement...',
      error: 'Une erreur est survenue',
      success: 'Opération réussie',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      back: 'Retour',
      retry: 'Réessayer'
    },
    help: {
      title: 'Guide & Assistance',
      subtitle: 'Comment accomplir vos tâches et recevoir vos gains',
      step1: '1. Récupérez le nom et le mot de passe indiqués pour la tâche.',
      step2: '2. Créez le compte selon les consignes officielles.',
      step3: '3. Exportez les cookies complets et notez l\'UID.',
      step4: '4. Soumettez la tâche. Dès validation par l\'administrateur, votre portefeuille est crédité de $0.04 USD.',
      contactSupport: 'Contacter le support officiel : @TaskifySupport'
    }
  },
  en: {
    appName: 'Taskify Pro',
    menu: {
      tasks: 'Tasks',
      myTasks: 'My Tasks',
      wallet: 'Wallet',
      withdraw: 'Withdraw',
      history: 'History',
      profile: 'Profile',
      settings: 'Settings',
      language: 'Language',
      help: 'Help & Rules',
      support: 'Support'
    },
    wallet: {
      title: 'My Wallet',
      availableBalance: 'Available Balance',
      pendingWithdrawals: 'Pending Withdrawals',
      totalEarned: 'Total Earned',
      totalWithdrawn: 'Total Withdrawn',
      minWithdrawalNotice: 'Minimum withdrawal threshold: $1.00 USD',
      withdrawNow: 'Request Withdrawal',
      noTransactions: 'No transactions recorded',
      ledgerTitle: 'Transaction Ledger'
    },
    withdraw: {
      title: 'Withdrawal Request',
      amount: 'Amount ($ USD)',
      method: 'Payment Method',
      destination: 'Receiving Account / Number',
      submit: 'Confirm Request',
      minAmount: 'Minimum withdrawal amount is $1.00 USD',
      insufficientBalance: 'Insufficient available balance',
      successNotice: 'Withdrawal request submitted successfully!',
      selectMethod: 'Select payment method',
      destinationPlaceholder: 'e.g. Phone number, PayPal email, or Bank IBAN',
      pendingRequests: 'Pending Requests'
    },
    tasks: {
      title: 'New Task',
      taskType: 'Task Type',
      uid: 'Account UID',
      firstName: 'Assigned First Name',
      lastName: 'Assigned Last Name',
      password: 'Required Password',
      cookies: 'Full Cookies',
      submit: 'Submit Task',
      status: 'Status',
      pending: 'Pending Validation',
      validated: 'Validated & Credited',
      rejected: 'Rejected',
      reward: 'Reward per task: $0.04 USD',
      rules: 'Task Guidelines',
      cookiesPlaceholder: 'Paste full cookies (e.g. datr=...; c_user=...; xs=...)',
      uidPlaceholder: 'e.g. 100084928172910',
      createdSuccess: 'Task submitted successfully! It will be verified by an administrator.'
    },
    myTasks: {
      title: 'My Submitted Tasks',
      empty: 'You have not submitted any tasks yet.',
      date: 'Submission Date',
      status: 'Validation Status',
      reward: 'Reward'
    },
    history: {
      title: 'Transaction History',
      empty: 'No transactions yet.',
      type: 'Type',
      amount: 'Amount',
      balanceAfter: 'Balance After',
      date: 'Date'
    },
    profile: {
      title: 'User Profile',
      telegramId: 'Telegram ID',
      username: 'Username',
      name: 'Full Name',
      language: 'Interface Language',
      stats: 'Global Statistics',
      completedTasks: 'Validated Tasks',
      pendingTasks: 'Pending Tasks',
      rejectedTasks: 'Rejected Tasks'
    },
    common: {
      loading: 'Loading...',
      error: 'An error occurred',
      success: 'Operation successful',
      cancel: 'Cancel',
      confirm: 'Confirm',
      back: 'Back',
      retry: 'Retry'
    },
    help: {
      title: 'Guidelines & Help',
      subtitle: 'How to complete tasks and receive earnings',
      step1: '1. Use the designated first name, last name, and password.',
      step2: '2. Create the account according to standard rules.',
      step3: '3. Export full cookies and copy the account UID.',
      step4: '4. Submit the task. Upon Admin validation, $0.04 USD is credited to your wallet.',
      contactSupport: 'Contact official support: @TaskifySupport'
    }
  },
  mg: {
    appName: 'Taskify Pro',
    menu: {
      tasks: 'Asa (Tâches)',
      myTasks: 'Ny Asako',
      wallet: 'Kitapom-bola',
      withdraw: 'Fanalana Vola',
      history: 'Tantara',
      profile: 'Mombamomba',
      settings: 'Fikirakirana',
      language: 'Fiteny',
      help: 'Torolalana',
      support: 'Fanampiana'
    },
    wallet: {
      title: 'Ny Kitapom-bolako',
      availableBalance: 'Vola azo alaina',
      pendingWithdrawals: 'Miandry fandoavana',
      totalEarned: 'Fitambaran\'ny vola azo',
      totalWithdrawn: 'Fitambaran\'ny efa niala',
      minWithdrawalNotice: 'Farafahakeliny azo alaina : $1.00 USD',
      withdrawNow: 'Mangataka fandoavana',
      noTransactions: 'Mbola tsy misy fidirana na fivoahana',
      ledgerTitle: 'Bokin\'ny kaonty (Ledger)'
    },
    withdraw: {
      title: 'Fangatahana Fanalana Vola',
      amount: 'Isan\'ny vola ($ USD)',
      method: 'Fomba fandoavana',
      destination: 'Laharana / Kaonty handraisana azy',
      submit: 'Alefa ny fangatahana',
      minAmount: 'Farafahakeliny $1.00 USD ny vola azo alaina',
      insufficientBalance: 'Tsy ampy ny vola azo alaina',
      successNotice: 'Voaray soa aman-tsara ny fangatahanao !',
      selectMethod: 'Safidio ny fomba handraisana vola',
      destinationPlaceholder: 'Ohatra : 034 00 000 00 na email PayPal',
      pendingRequests: 'Fangatahana miandry'
    },
    tasks: {
      title: 'Hanao Asa Vaovao',
      taskType: 'Karazan\'asa',
      uid: 'UID an\'ny kaonty',
      firstName: 'Anarana voalohany nomena',
      lastName: 'Fanampin\'anarana nomena',
      password: 'Teny miafina takiana',
      cookies: 'Cookies feno',
      submit: 'Alefa ny asa',
      status: 'Toe-javatra',
      pending: 'Miandry fanamarinana',
      validated: 'Voamarina & Voaloa',
      rejected: 'Nolavina',
      reward: 'Karama isaky ny asa : $0.04 USD',
      rules: 'Fitsipika arahina',
      cookiesPlaceholder: 'Apetaho eto ny cookies feno (ohatra: datr=...; c_user=...; xs=...)',
      uidPlaceholder: 'Ohatra : 100084928172910',
      createdSuccess: 'Voaray soa aman-tsara ny asanao ! Hojeren\'ny mpitantana avy hatrany.'
    },
    myTasks: {
      title: 'Ireo Asa Efa Vitako',
      empty: 'Mbola tsy nandefa asa ianao.',
      date: 'Daty nandefasana',
      status: 'Toetry ny fanamarinana',
      reward: 'Tombony'
    },
    history: {
      title: 'Tantaran\'ny Fidirana sy Fivoaham-bola',
      empty: 'Mbola tsy misy hetsika.',
      type: 'Karazany',
      amount: 'Vola',
      balanceAfter: 'Solde sisa',
      date: 'Daty'
    },
    profile: {
      title: 'Mombamomba ny Mpampiasa',
      telegramId: 'ID Telegram',
      username: 'Anaran\'ny kaonty Telegram',
      name: 'Anarana feno',
      language: 'Fiteny ampiasaina',
      stats: 'Antontan\'isa',
      completedTasks: 'Asa nekena',
      pendingTasks: 'Asa miandry',
      rejectedTasks: 'Asa nolavina'
    },
    common: {
      loading: 'Eo am-pikarohana...',
      error: 'Nisy olana nitranga',
      success: 'Tontosa soa aman-tsara',
      cancel: 'Aoka ihany',
      confirm: 'Eny, manaiky',
      back: 'Miverina',
      retry: 'Andramo indray'
    },
    help: {
      title: 'Torolalana sy Fitsipika',
      subtitle: 'Ahoana ny fomba fanatanterahana asa sy fakana vola',
      step1: '1. Ampiasao ny anarana sy ny teny miafina nomena.',
      step2: '2. Forony ny kaonty araka ny fitsipika.',
      step3: '3. Raiso ny cookies feno sy ny UID.',
      step4: '4. Alefaso ny asa. Rehefa manaiky ny Administrateur dia mahazo $0.04 USD ianao.',
      contactSupport: 'Fifandraisana amin\'ny mpitantana : @TaskifySupport'
    }
  }
};
