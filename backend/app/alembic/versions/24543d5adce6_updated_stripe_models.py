"""Updated Stripe Models

Revision ID: 24543d5adce6
Revises: 7cdb0583d714
Create Date: 2025-03-12 23:32:54.049945

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '24543d5adce6'
down_revision = '7cdb0583d714'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('plan',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('stripe_product_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('stripe_product_id')
    )
    op.create_index(op.f('ix_plan_name'), 'plan', ['name'], unique=False)
    op.create_table('customer',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('stripe_customer_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_customer_stripe_customer_id'), 'customer', ['stripe_customer_id'], unique=True)
    op.create_table('price',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('plan_id', sa.Uuid(), nullable=False),
    sa.Column('stripe_price_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('interval', sa.Enum('MONTH', 'YEAR', name='planinterval'), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['plan_id'], ['plan.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('stripe_price_id')
    )
    op.create_table('paymentmethod',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('customer_id', sa.Uuid(), nullable=False),
    sa.Column('stripe_payment_method_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('card_last4', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('card_brand', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('card_exp_month', sa.Integer(), nullable=True),
    sa.Column('card_exp_year', sa.Integer(), nullable=True),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_paymentmethod_stripe_payment_method_id'), 'paymentmethod', ['stripe_payment_method_id'], unique=True)
    op.create_table('subscription',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('customer_id', sa.Uuid(), nullable=False),
    sa.Column('price_id', sa.Uuid(), nullable=False),
    sa.Column('stripe_subscription_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('status', sa.Enum('ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', name='subscriptionstatus'), nullable=False),
    sa.Column('current_period_start', sa.DateTime(), nullable=False),
    sa.Column('current_period_end', sa.DateTime(), nullable=False),
    sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False),
    sa.Column('canceled_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], ),
    sa.ForeignKeyConstraint(['price_id'], ['price.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_subscription_stripe_subscription_id'), 'subscription', ['stripe_subscription_id'], unique=True)
    op.create_table('invoice',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('subscription_id', sa.Uuid(), nullable=False),
    sa.Column('stripe_invoice_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('amount_paid', sa.Integer(), nullable=False),
    sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('invoice_pdf', sa.String(length=2048), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['subscription_id'], ['subscription.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invoice_stripe_invoice_id'), 'invoice', ['stripe_invoice_id'], unique=True)
    op.drop_index('ix_stripeprice_stripe_price_id', table_name='stripeprice')
    op.drop_table('stripeprice')
    op.drop_index('ix_stripeproduct_stripe_product_id', table_name='stripeproduct')
    op.drop_table('stripeproduct')
    op.drop_index('ix_stripepayment_stripe_payment_id', table_name='stripepayment')
    op.drop_table('stripepayment')
    op.drop_index('ix_stripecustomer_stripe_customer_id', table_name='stripecustomer')
    op.drop_table('stripecustomer')
    op.drop_index('ix_stripesubscription_stripe_subscription_id', table_name='stripesubscription')
    op.drop_table('stripesubscription')
    op.alter_column('user', 'hashed_password',
               existing_type=sa.VARCHAR(),
               nullable=False)
    op.drop_index('ix_user_google_id', table_name='user')
    op.drop_index('ix_user_stripe_customer_id', table_name='user')
    op.drop_column('user', 'stripe_customer_id')
    op.drop_column('user', 'google_id')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('user', sa.Column('google_id', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('user', sa.Column('stripe_customer_id', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.create_index('ix_user_stripe_customer_id', 'user', ['stripe_customer_id'], unique=True)
    op.create_index('ix_user_google_id', 'user', ['google_id'], unique=True)
    op.alter_column('user', 'hashed_password',
               existing_type=sa.VARCHAR(),
               nullable=True)
    op.create_table('stripesubscription',
    sa.Column('status', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
    sa.Column('current_period_start', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('current_period_end', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('cancel_at_period_end', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('stripe_subscription_id', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('price_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('customer_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['stripecustomer.id'], name='stripesubscription_customer_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['price_id'], ['stripeprice.id'], name='stripesubscription_price_id_fkey'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], name='stripesubscription_user_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='stripesubscription_pkey')
    )
    op.create_index('ix_stripesubscription_stripe_subscription_id', 'stripesubscription', ['stripe_subscription_id'], unique=True)
    op.create_table('stripecustomer',
    sa.Column('stripe_customer_id', sa.VARCHAR(), autoincrement=False, nullable=False),
    sa.Column('is_active', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], name='stripecustomer_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='stripecustomer_pkey'),
    postgresql_ignore_search_path=False
    )
    op.create_index('ix_stripecustomer_stripe_customer_id', 'stripecustomer', ['stripe_customer_id'], unique=False)
    op.create_table('stripepayment',
    sa.Column('stripe_payment_id', sa.VARCHAR(), autoincrement=False, nullable=False),
    sa.Column('amount', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('currency', sa.VARCHAR(length=3), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
    sa.Column('payment_method_type', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
    sa.Column('created', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('customer_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['stripecustomer.id'], name='stripepayment_customer_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='stripepayment_pkey')
    )
    op.create_index('ix_stripepayment_stripe_payment_id', 'stripepayment', ['stripe_payment_id'], unique=False)
    op.create_table('stripeproduct',
    sa.Column('name', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
    sa.Column('description', sa.VARCHAR(length=1000), autoincrement=False, nullable=True),
    sa.Column('active', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('stripe_product_id', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name='stripeproduct_pkey'),
    postgresql_ignore_search_path=False
    )
    op.create_index('ix_stripeproduct_stripe_product_id', 'stripeproduct', ['stripe_product_id'], unique=False)
    op.create_table('stripeprice',
    sa.Column('unit_amount', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('currency', sa.VARCHAR(length=3), autoincrement=False, nullable=False),
    sa.Column('recurring_interval', sa.VARCHAR(length=10), autoincrement=False, nullable=True),
    sa.Column('stripe_price_id', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
    sa.Column('active', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('product_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['stripeproduct.id'], name='stripeprice_product_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='stripeprice_pkey')
    )
    op.create_index('ix_stripeprice_stripe_price_id', 'stripeprice', ['stripe_price_id'], unique=False)
    op.drop_index(op.f('ix_invoice_stripe_invoice_id'), table_name='invoice')
    op.drop_table('invoice')
    op.drop_index(op.f('ix_subscription_stripe_subscription_id'), table_name='subscription')
    op.drop_table('subscription')
    op.drop_index(op.f('ix_paymentmethod_stripe_payment_method_id'), table_name='paymentmethod')
    op.drop_table('paymentmethod')
    op.drop_table('price')
    op.drop_index(op.f('ix_customer_stripe_customer_id'), table_name='customer')
    op.drop_table('customer')
    op.drop_index(op.f('ix_plan_name'), table_name='plan')
    op.drop_table('plan')
    # ### end Alembic commands ###
